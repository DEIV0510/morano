// Pedidos: creación idempotente, confirmación de pago y notificaciones.
// Sin panel administrativo: cada pedido llega completo por correo al buzón
// comercial (y al CRM si está configurado); el estado lo actualiza Stripe.
import { config, stripeConfigured } from './config.ts';
import { all, batch, get, run } from './db.ts';
import { ApiError } from './http.ts';
import { route, t, type Locale } from './i18n.ts';
import { log } from './log.ts';
import { layout, sendMail, table, textTable, esc } from './mail.ts';
import { createCheckoutSession, type SessionLine } from './payments/stripe.ts';
import { formatMoney, priceCart, type PricedCart } from './pricing.ts';
import { hashIp, publicRef, randomToken, safeEqual, sha256 } from './security/crypto.ts';
import { getSettings, type Settings } from './settings.ts';
import type { CheckoutInput } from './validation.ts';
import { countryName } from './countries.ts';
import { pushToCrm } from './crm.ts';

export type OrderStatus = 'pending' | 'paid' | 'refunded';

export interface OrderRow {
  id: number;
  ref: string;
  access_hash: string;
  idempotency_key: string;
  status: OrderStatus;
  payment_method: 'stripe' | 'proforma';
  currency: string;
  subtotal_cents: number;
  shipping_cents: number | null;
  vat_rate_bp: number;
  vat_included: number;
  vat_cents: number;
  total_cents: number;
  customer_name: string;
  company: string;
  tax_id: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  postal_code: string;
  region: string;
  country: string;
  notes: string;
  locale: Locale;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  paid_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface OrderItemRow {
  id: number;
  order_id: number;
  product_slug: string;
  sku: string;
  product_name: string;
  variant_label: string;
  unit_price_cents: number;
  qty: number;
  line_total_cents: number;
}

export function paymentMode(cart: PricedCart, s: Settings): 'stripe' | 'proforma' {
  return stripeConfigured() && s.cardPaymentsEnabled && cart.shippingCents !== null && cart.lines.length > 0 ? 'stripe' : 'proforma';
}

/** Líneas para Stripe que suman exactamente el total del pedido. */
function stripeLines(order: Pick<OrderRow, 'shipping_cents' | 'vat_included' | 'vat_cents' | 'vat_rate_bp' | 'locale'>, items: Pick<OrderItemRow, 'product_name' | 'variant_label' | 'unit_price_cents' | 'qty'>[]): SessionLine[] {
  const L = order.locale;
  const lines: SessionLine[] = items.map((i) => ({ name: `${i.product_name} · ${i.variant_label}`, unitCents: i.unit_price_cents, qty: i.qty }));
  if (order.shipping_cents) lines.push({ name: t(L, 'cart.shipping'), unitCents: order.shipping_cents, qty: 1 });
  if (!order.vat_included && order.vat_cents > 0) {
    lines.push({ name: `${t(L, 'cart.vat')} ${(order.vat_rate_bp / 100).toLocaleString(L)} %`, unitCents: order.vat_cents, qty: 1 });
  }
  return lines;
}

export async function createOrder(input: CheckoutInput, ip: string) {
  const settings = await getSettings();
  const locale = input.locale;

  // Idempotencia: un doble clic o un reintento devuelve el mismo pedido.
  const existing = await get<OrderRow>('SELECT * FROM orders WHERE idempotency_key = ?', [input.idempotencyKey]);
  if (existing) return resumeOrder(existing);

  const cart = priceCart({ items: input.items }, settings, locale);
  if (!cart.lines.length) throw new ApiError(409, 'cart_empty', 'Cart is empty');
  if (cart.issues.length) throw new ApiError(409, 'cart_changed', 'Cart changed');

  const method = paymentMode(cart, settings);
  const token = randomToken(24);
  const now = Date.now();
  const c = input.customer;

  let ref = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    ref = publicRef('ME');
    try {
      await batch([
        {
          sql: `INSERT INTO orders (ref, access_hash, idempotency_key, status, payment_method, currency, subtotal_cents, shipping_cents,
                  vat_rate_bp, vat_included, vat_cents, total_cents, customer_name, company, tax_id, email, phone, address_line1,
                  address_line2, city, postal_code, region, country, notes, locale, ip_hash, created_at, updated_at)
                VALUES (?, ?, ?, 'pending', ?, 'EUR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            ref, sha256(token), input.idempotencyKey, method, cart.subtotalCents, cart.shippingCents, cart.vatRateBp,
            cart.vatIncluded ? 1 : 0, cart.vatCents, cart.totalCents, c.fullName, c.company, c.taxId, c.email, c.phone, c.address1,
            c.address2, c.city, c.postalCode, c.region, c.country, c.notes, locale, hashIp(ip), now, now,
          ],
        },
        ...cart.lines.map((l) => ({
          sql: `INSERT INTO order_items (order_id, product_slug, sku, product_name, variant_label, unit_price_cents, qty, line_total_cents)
                VALUES ((SELECT id FROM orders WHERE ref = ?), ?, ?, ?, ?, ?, ?, ?)`,
          args: [ref, l.productSlug, l.sku, `${l.productCode} — ${l.productName}`, l.variantLabel, l.unitCents, l.qty, l.lineCents],
        })),
        {
          sql: `INSERT INTO order_events (order_id, at, actor, type, to_status, note) VALUES ((SELECT id FROM orders WHERE ref = ?), ?, 'customer', 'created', 'pending', ?)`,
          args: [ref, now, method === 'stripe' ? 'Pago con tarjeta (Stripe)' : 'Pedido con factura proforma'],
        },
      ]);
      break;
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes('UNIQUE') && msg.includes('idempotency_key')) {
        const again = await get<OrderRow>('SELECT * FROM orders WHERE idempotency_key = ?', [input.idempotencyKey]);
        if (again) return resumeOrder(again);
      }
      if (msg.includes('UNIQUE') && msg.includes('orders.ref') && attempt < 4) continue;
      throw e;
    }
  }

  const order = (await get<OrderRow>('SELECT * FROM orders WHERE ref = ?', [ref]))!;
  const items = await all<OrderItemRow>('SELECT * FROM order_items WHERE order_id = ?', [order.id]);

  // Correos y CRM: no bloquean el pedido si fallan.
  notifyOrderCreated(order, items).catch((e) => log.error('order.notify', e));

  if (method === 'stripe') {
    const session = await createCheckoutSession({
      orderRef: order.ref,
      attempt: 0,
      locale,
      email: order.email,
      lines: stripeLines(order, items),
      totalCents: order.total_cents,
    });
    await run('UPDATE orders SET stripe_session_id = ?, updated_at = ? WHERE id = ?', [session.id, Date.now(), order.id]);
    return { ref: order.ref, token, method, redirect: session.url };
  }
  return { ref: order.ref, token, method, redirect: `${route('order', locale, encodeURIComponent(order.ref))}?t=${token}` };
}

/** Reintento idempotente: no se crea un segundo pedido. */
async function resumeOrder(order: OrderRow) {
  // El token original no se puede recuperar (solo guardamos su hash): se emite uno nuevo.
  const token = randomToken(24);
  await run('UPDATE orders SET access_hash = ?, updated_at = ? WHERE id = ?', [sha256(token), Date.now(), order.id]);
  if (order.payment_method === 'stripe' && order.status === 'pending') {
    const retry = await retryStripeSession(order);
    return { ref: order.ref, token, method: order.payment_method, redirect: retry };
  }
  return { ref: order.ref, token, method: order.payment_method, redirect: `${route('order', order.locale, encodeURIComponent(order.ref))}?t=${token}` };
}

export async function retryStripeSession(order: OrderRow): Promise<string> {
  if (order.status !== 'pending' || order.payment_method !== 'stripe') throw new ApiError(409, 'not_payable', 'Order not payable');
  const items = await all<OrderItemRow>('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  const attempts = await get<{ n: number }>("SELECT COUNT(*) AS n FROM order_events WHERE order_id = ? AND type = 'payment_retry'", [order.id]);
  const n = (attempts?.n ?? 0) + 1;
  const session = await createCheckoutSession({
    orderRef: order.ref,
    attempt: n,
    locale: order.locale,
    email: order.email,
    lines: stripeLines(order, items),
    totalCents: order.total_cents,
  });
  await batch([
    { sql: 'UPDATE orders SET stripe_session_id = ?, updated_at = ? WHERE id = ?', args: [session.id, Date.now(), order.id] },
    { sql: "INSERT INTO order_events (order_id, at, actor, type, note) VALUES (?, ?, 'customer', 'payment_retry', ?)", args: [order.id, Date.now(), `Intento ${n}`] },
  ]);
  return session.url;
}

/** Acceso del cliente a su pedido: token del enlace o sesión de Stripe asociada. */
export async function findOrderForCustomer(ref: string, opts: { token?: string | null; sessionId?: string | null }) {
  if (!/^ME-\d{2}-[A-Z0-9]{7}$/.test(ref)) return undefined;
  const order = await get<OrderRow>('SELECT * FROM orders WHERE ref = ?', [ref]);
  if (!order) return undefined;
  const okToken = opts.token ? safeEqual(sha256(opts.token), order.access_hash) : false;
  const okSession = opts.sessionId && order.stripe_session_id ? safeEqual(opts.sessionId, order.stripe_session_id) : false;
  if (!okToken && !okSession) return undefined;
  const items = await all<OrderItemRow>('SELECT * FROM order_items WHERE order_id = ? ORDER BY id', [order.id]);
  return { order, items };
}

/** Cambio de estado condicionado al estado anterior (evita carreras entre entregas del webhook). */
async function setStatus(order: OrderRow, to: OrderStatus, actor: string, note: string) {
  const r = await run('UPDATE orders SET status = ?, updated_at = ?, paid_at = COALESCE(paid_at, ?) WHERE id = ? AND status = ?', [
    to, Date.now(), to === 'paid' ? Date.now() : null, order.id, order.status,
  ]);
  if (!r.changes) return false;
  await run('INSERT INTO order_events (order_id, at, actor, type, from_status, to_status, note) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    order.id, Date.now(), actor, 'status', order.status, to, note.slice(0, 1000),
  ]);
  return true;
}

/** Confirmación de pago desde el webhook de Stripe, con verificación de importe. */
export async function confirmStripePayment(s: { ref: string; sessionId: string; paymentIntent: string | null; amountTotal: number; currency: string; paymentStatus: string }) {
  const order = await get<OrderRow>('SELECT * FROM orders WHERE ref = ?', [s.ref]);
  if (!order) return { ok: false, reason: 'order_not_found' };
  if (order.payment_method !== 'stripe') return { ok: false, reason: 'not_stripe_order' };
  if (s.paymentStatus !== 'paid') return { ok: false, reason: 'not_paid' };
  if (s.currency.toLowerCase() !== 'eur' || s.amountTotal !== order.total_cents) {
    await run("INSERT INTO order_events (order_id, at, actor, type, note) VALUES (?, ?, 'system', 'amount_mismatch', ?)", [
      order.id, Date.now(), `Stripe ${s.amountTotal} ${s.currency} ≠ pedido ${order.total_cents} EUR`,
    ]);
    return { ok: false, reason: 'amount_mismatch' };
  }
  if (order.status !== 'pending') return { ok: true, reason: 'already_processed' };
  await run('UPDATE orders SET stripe_session_id = ?, stripe_payment_intent = ? WHERE id = ?', [s.sessionId, s.paymentIntent, order.id]);
  const changed = await setStatus(order, 'paid', 'stripe', `Pago confirmado por webhook (${s.paymentIntent ?? s.sessionId})`);
  if (changed) {
    const updated = (await get<OrderRow>('SELECT * FROM orders WHERE id = ?', [order.id]))!;
    notifyPaid(updated).catch((e) => log.error('order.notifyPaid', e));
  }
  return { ok: true, reason: changed ? 'paid' : 'already_processed' };
}

/** Reembolso total registrado en Stripe. */
export async function markRefunded(paymentIntent: string) {
  const order = await get<OrderRow>('SELECT * FROM orders WHERE stripe_payment_intent = ?', [paymentIntent]);
  if (!order || order.status !== 'paid') return undefined;
  return (await setStatus(order, 'refunded', 'stripe', 'Reembolso total registrado en Stripe')) ? order.ref : undefined;
}

// ── Notificaciones ──
function summaryRows(o: OrderRow, items: OrderItemRow[]): [string, string][] {
  const L = o.locale;
  const rows: [string, string][] = items.map((i) => [`${i.qty} × ${i.product_name} (${i.variant_label})`, formatMoney(i.line_total_cents, L)]);
  rows.push([t(L, 'cart.subtotal'), formatMoney(o.subtotal_cents, L)]);
  rows.push([t(L, 'cart.shipping'), o.shipping_cents === null ? t(L, 'cart.shippingPending') : o.shipping_cents === 0 ? t(L, 'cart.shippingFree') : formatMoney(o.shipping_cents, L)]);
  rows.push([o.vat_included ? t(L, 'cart.vatIncludedLine') : t(L, 'cart.vat'), formatMoney(o.vat_cents, L)]);
  rows.push([t(L, 'cart.total'), formatMoney(o.total_cents, L)]);
  return rows;
}

function customerRows(o: OrderRow): [string, string][] {
  return [
    ['Cliente', o.customer_name],
    ['Empresa', o.company || '—'],
    ['NIF / VAT', o.tax_id || '—'],
    ['Correo', o.email],
    ['Teléfono', o.phone],
    ['Dirección', [o.address_line1, o.address_line2, `${o.postal_code} ${o.city}`, o.region, countryName(o.country, 'es')].filter(Boolean).join('\n')],
    ['Notas', o.notes || '—'],
    ['Idioma', o.locale.toUpperCase()],
  ];
}

async function notifyOrderCreated(o: OrderRow, items: OrderItemRow[]) {
  const L = o.locale;
  const es = L === 'es';
  const intro = es
    ? o.payment_method === 'stripe'
      ? 'Hemos registrado su pedido. Lo confirmaremos en cuanto Stripe nos notifique el pago.'
      : 'Hemos registrado su pedido. Nuestro equipo comercial le enviará la factura proforma con el importe final, el envío y las instrucciones de pago.'
    : o.payment_method === 'stripe'
      ? 'Your order has been registered. We will confirm it as soon as Stripe notifies us of the payment.'
      : 'Your order has been registered. Our commercial team will send you a proforma invoice with the final amount, shipping and payment instructions.';
  const subject = es ? `Pedido ${o.ref} recibido — Morano Europe` : `Order ${o.ref} received — Morano Europe`;
  const rows = summaryRows(o, items);
  await sendMail({
    to: o.email,
    subject,
    text: `${intro}\n\n${t(L, 'common.reference')}: ${o.ref}\n\n${textTable(rows)}`,
    html: layout(subject, `<p>${esc(o.customer_name)},</p><p>${esc(intro)}</p><p><strong>${esc(t(L, 'common.reference'))}: ${esc(o.ref)}</strong></p>${table(rows)}`),
    template: 'order-created',
    related: o.ref,
  });
  const next =
    o.payment_method === 'stripe'
      ? 'Pago con tarjeta pendiente: llegará otro correo cuando Stripe lo confirme.'
      : 'Acción comercial: enviar al cliente la factura proforma con el importe final, el envío y las instrucciones de pago (responder a este correo).';
  await sendMail({
    to: config.mail.sales,
    replyTo: o.email,
    subject: `Nuevo pedido ${o.ref} (${o.payment_method === 'stripe' ? 'tarjeta' : 'proforma'}) — ${formatMoney(o.total_cents, 'es')}`,
    text: `${next}\n\n${textTable(customerRows(o))}\n\n${textTable(summaryRows({ ...o, locale: 'es' }, items))}`,
    html: layout('Nuevo pedido', `<p>Nuevo pedido <strong>${esc(o.ref)}</strong>.</p><p>${esc(next)}</p>${table(customerRows(o))}${table(summaryRows({ ...o, locale: 'es' }, items))}`),
    template: 'order-created-sales',
    related: o.ref,
  });
  await pushToCrm('order', {
    ref: o.ref, status: o.status, paymentMethod: o.payment_method, totalCents: o.total_cents, currency: 'EUR',
    customer: { name: o.customer_name, company: o.company, taxId: o.tax_id, email: o.email, phone: o.phone, country: o.country },
    items: items.map((i) => ({ sku: i.sku, name: i.product_name, variant: i.variant_label, qty: i.qty, unitCents: i.unit_price_cents })),
  });
}

async function notifyPaid(o: OrderRow) {
  const es = o.locale === 'es';
  const subject = es ? `Pago confirmado · pedido ${o.ref}` : `Payment confirmed · order ${o.ref}`;
  const body = es
    ? `Hemos recibido el pago de su pedido ${o.ref} por ${formatMoney(o.total_cents, 'es')}. Le avisaremos cuando salga.`
    : `We have received the payment for order ${o.ref} (${formatMoney(o.total_cents, 'en')}). We will let you know when it ships.`;
  await sendMail({ to: o.email, subject, text: body, html: layout(subject, `<p>${esc(body)}</p>`), template: 'order-paid', related: o.ref });
  await sendMail({
    to: config.mail.sales,
    replyTo: o.email,
    subject: `Pago confirmado ${o.ref} — ${formatMoney(o.total_cents, 'es')}: preparar envío`,
    text: `Stripe confirmó el pago del pedido ${o.ref} (${o.customer_name}, ${o.email}). Preparar el envío y avisar al cliente.`,
    html: layout('Pago confirmado', `<p>Stripe confirmó el pago del pedido <strong>${esc(o.ref)}</strong> de ${esc(o.customer_name)} (${esc(o.email)}).</p><p>Preparar el envío y avisar al cliente respondiendo a este correo.</p>`),
    template: 'order-paid-sales',
    related: o.ref,
  });
}
