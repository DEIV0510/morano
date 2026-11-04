// Integración del webhook de Stripe con una base de datos de prueba aislada.
// No necesita el servidor ni conexión con Stripe: se firman eventos locales
// con un secreto de prueba y se llama directamente al endpoint.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { rmSync } from 'node:fs';

const DB_FILE = 'data/test-webhook.db';
for (const f of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
  try {
    rmSync(f, { force: true });
  } catch {
    /* bloqueado por una ejecución anterior */
  }
}
process.env.DATABASE_URL = `file:${DB_FILE}`;
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';
process.env.APP_SECRET ||= 'webhook-test-secret-webhook-test-secret-123';

const { migrate } = await import('../../src/lib/migrate.ts');
const { seedCatalog } = await import('../../src/lib/seed.ts');
const { get, run, db } = await import('../../src/lib/db.ts');
const { POST } = await import('../../src/pages/api/webhooks/stripe.ts');

const SECRET = 'whsec_local_only';
let variantId;

function signed(event, secret = SECRET, t = Math.floor(Date.now() / 1000)) {
  const payload = JSON.stringify(event);
  const sig = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${sig}` },
    body: payload,
  });
}

async function makeOrder(ref, total) {
  const now = Date.now();
  await run(
    `INSERT INTO orders (ref, access_hash, idempotency_key, status, payment_method, subtotal_cents, shipping_cents, vat_rate_bp, vat_included, vat_cents, total_cents,
       customer_name, email, phone, address_line1, city, postal_code, country, created_at, updated_at)
     VALUES (?, 'x', ?, 'pending', 'stripe', ?, 0, 2100, 1, 0, ?, 'QA', 'qa@test.local', '600000000', 'Calle 1', 'Madrid', '28001', 'ES', ?, ?)`,
    [ref, `idem-${ref}`, total, total, now, now]
  );
  const o = await get('SELECT id FROM orders WHERE ref = ?', [ref]);
  await run('INSERT INTO order_items (order_id, product_id, variant_id, sku, product_name, variant_label, unit_price_cents, qty, line_total_cents) VALUES (?, NULL, ?, ?, ?, ?, ?, 2, ?)', [
    o.id, variantId, 'PKE-1KG', 'PKE', '1 kg', total / 2, total,
  ]);
  return o.id;
}

const completed = (id, ref, amount) => ({
  id,
  type: 'checkout.session.completed',
  data: { object: { id: `cs_${id}`, metadata: { order_ref: ref }, amount_total: amount, currency: 'eur', payment_status: 'paid', payment_intent: `pi_${id}` } },
});

before(async () => {
  await migrate();
  await seedCatalog();
  const v = await get("SELECT id FROM variants WHERE sku = 'PKE-1KG'");
  variantId = v.id;
  await run('UPDATE variants SET price_cents = 790, stock = 5 WHERE id = ?', [variantId]);
});

after(async () => {
  (await db()).close();
  // En Windows el archivo puede seguir bloqueado un instante: se borra en la próxima ejecución.
  for (const f of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
    try {
      rmSync(f, { force: true });
    } catch {
      /* se limpia al inicio de la siguiente ejecución */
    }
  }
});

test('pago confirmado: el pedido pasa a pagado y descuenta existencias una sola vez', async () => {
  await makeOrder('ME-26-WHAAAA1', 1580);
  const res = await POST({ request: signed(completed('evt_ok_1', 'ME-26-WHAAAA1', 1580)) });
  assert.equal(res.status, 200);
  const o = await get("SELECT status, stock_applied, stripe_payment_intent FROM orders WHERE ref = 'ME-26-WHAAAA1'");
  assert.equal(o.status, 'paid');
  assert.equal(o.stock_applied, 1);
  assert.equal(o.stripe_payment_intent, 'pi_evt_ok_1');
  assert.equal((await get('SELECT stock FROM variants WHERE id = ?', [variantId])).stock, 3);

  // Stripe reintenta la entrega del mismo evento: sin efectos repetidos.
  const again = await POST({ request: signed(completed('evt_ok_1', 'ME-26-WHAAAA1', 1580)) });
  assert.equal(again.status, 200);
  assert.equal((await again.json()).duplicate, true);
  assert.equal((await get('SELECT stock FROM variants WHERE id = ?', [variantId])).stock, 3);
});

test('importe distinto al del pedido: NO se marca como pagado', async () => {
  await makeOrder('ME-26-WHBBBB2', 1580);
  const res = await POST({ request: signed(completed('evt_bad_amount', 'ME-26-WHBBBB2', 100)) });
  assert.equal(res.status, 200);
  assert.equal((await get("SELECT status FROM orders WHERE ref = 'ME-26-WHBBBB2'")).status, 'pending');
  const ev = await get("SELECT type FROM order_events WHERE type = 'amount_mismatch'");
  assert.ok(ev, 'queda registrado el desajuste');
});

test('sesión no pagada (pago asíncrono pendiente): sigue pendiente', async () => {
  await makeOrder('ME-26-WHCCCC3', 1580);
  const ev = completed('evt_unpaid', 'ME-26-WHCCCC3', 1580);
  ev.data.object.payment_status = 'unpaid';
  await POST({ request: signed(ev) });
  assert.equal((await get("SELECT status FROM orders WHERE ref = 'ME-26-WHCCCC3'")).status, 'pending');
});

test('firma inválida, secreto ajeno o evento caducado: 400 y sin cambios', async () => {
  await makeOrder('ME-26-WHDDDD4', 1580);
  const forged = await POST({ request: signed(completed('evt_forged', 'ME-26-WHDDDD4', 1580), 'whsec_atacante') });
  assert.equal(forged.status, 400);
  const old = await POST({ request: signed(completed('evt_old', 'ME-26-WHDDDD4', 1580), SECRET, Math.floor(Date.now() / 1000) - 3600) });
  assert.equal(old.status, 400);
  const unsigned = await POST({ request: new Request('http://localhost/x', { method: 'POST', body: '{}' }) });
  assert.equal(unsigned.status, 400);
  assert.equal((await get("SELECT status FROM orders WHERE ref = 'ME-26-WHDDDD4'")).status, 'pending');
});

test('reembolso total en Stripe: el pedido pasa a reembolsado y repone existencias', async () => {
  const before = (await get('SELECT stock FROM variants WHERE id = ?', [variantId])).stock;
  const res = await POST({ request: signed({ id: 'evt_refund', type: 'charge.refunded', data: { object: { payment_intent: 'pi_evt_ok_1', refunded: true } } }) });
  assert.equal(res.status, 200);
  assert.equal((await get("SELECT status FROM orders WHERE ref = 'ME-26-WHAAAA1'")).status, 'refunded');
  assert.equal((await get('SELECT stock FROM variants WHERE id = ?', [variantId])).stock, before + 2);
});
