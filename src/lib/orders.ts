// Pedidos: creación idempotente, estados, inventario y notificaciones.
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

export const ORDER_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Transiciones permitidas (se validan en el servidor). */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'shipped', 'refunded', 'cancelled'],
  processing: ['shipped', 'refunded', 'cancelled'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

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
  stock_applied: number;
  internal_notes: string;
  created_at: number;
  updated_at: number;
}

export interface OrderItemRow {
  id: number;
  order_id: number;
  product_id: number | null;
  variant_id: number | null;
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

  const cart = await priceCart({ items: input.items }, settings, locale);
  if (!cart.lines.length) throw new ApiError(409, 'cart_empty', 'Cart is empty', {});
  if (cart.issues.length) {
    const err = new ApiError(409, 'cart_changed', 'Cart changed');
    (err as any).cart = cart;
    throw err;
  }

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
          sql: `INSERT INTO order_items (order_id, product_id, variant_id, sku, product_name, variant_label, unit_price_cents, qty, line_total_cents)
                VALUES ((SELECT id FROM orders WHERE ref = ?), ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [ref, l.productId, l.variantId, l.sku, `${l.productCode} — ${l.productName}`, l.variantLabel, l.unitCents, l.qty, l.lineCents],
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

// ── Inventario ──
async function applyStock(order: OrderRow, direction: -1 | 1) {
  const items = await all<OrderItemRow>('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  for (const i of items) {
    if (!i.variant_id) continue;
    if (direction === -1) {
      // Descuento atómico: solo si hay existencias suficientes; sin control de stock (NULL) no cambia nada.
      const r = await run('UPDATE variants SET stock = stock - ?, updated_at = ? WHERE id = ? AND stock IS NOT NULL AND stock >= ?', [i.qty, Date.now(), i.variant_id, i.qty]);
      if (!r.changes) {
        const v = await get<{ stock: number | null }>('SELECT stock FROM variants WHERE id = ?', [i.variant_id]);
        if (v && v.stock !== null) {
          await run('UPDATE variants SET stock = 0, updated_at = ? WHERE id = ?', [Date.now(), i.variant_id]);
          await addEvent(order.id, 'system', 'stock_warning', null, null, `Existencias insuficientes para ${i.sku}: revisar.`);
        }
      }
    } else {
      await run('UPDATE variants SET stock = stock + ?, updated_at = ? WHERE id = ? AND stock IS NOT NULL', [i.qty, Date.now(), i.variant_id]);
    }
  }
  await run('UPDATE orders SET stock_applied = ? WHERE id = ?', [direction === -1 ? 1 : 0, order.id]);
}

async function addEvent(orderId: number, actor: string, type: string, from: string | null, to: string | null, note = '') {
  await run('INSERT INTO order_events (order_id, at, actor, type, from_status, to_status, note) VALUES (?, ?, ?, ?, ?, ?, ?)', [orderId, Date.now(), actor, type, from, to, note]);
}

/** Cambio de estado validado. Devuelve el pedido actualizado. */
export async function changeStatus(orderId: number, to: OrderStatus, actor: string, note = '', opts: { notify?: boolean } = {}) {
  const order = await get<OrderRow>('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) throw new ApiError(404, 'not_found', 'Order not found');
  if (!TRANSITIONS[order.status].includes(to)) throw new ApiError(409, 'invalid_transition', `No se puede pasar de ${order.status} a ${to}`);
  // Cambio condicionado al estado leído: evita carreras entre dos administradores o con el webhook.
  const r = await run('UPDATE orders SET status = ?, updated_at = ?, paid_at = COALESCE(paid_at, ?) WHERE id = ? AND status = ?', [
    to, Date.now(), to === 'paid' ? Date.now() : null, orderId, order.status,
  ]);
  if (!r.changes) throw new ApiError(409, 'conflict', 'El pedido cambió mientras tanto; recargue la página.');
  await addEvent(orderId, actor, 'status', order.status, to, note.slice(0, 1000));
  const updated = (await get<OrderRow>('SELECT * FROM orders WHERE id = ?', [orderId]))!;
  if (to === 'paid' && !order.stock_applied) await applyStock(updated, -1);
  if ((to === 'cancelled' || to === 'refunded') && updated.stock_applied) await applyStock(updated, 1);
  if (opts.notify) notifyStatus(updated).catch((e) => log.error('order.notifyStatus', e));
  return updated;
}

/** Confirmación de pago desde el webhook de Stripe, con verificación de importe. */
export async function confirmStripePayment(s: { ref: string; sessionId: string; paymentIntent: string | null; amountTotal: number; currency: string; paymentStatus: string }) {
  const order = await get<OrderRow>('SELECT * FROM orders WHERE ref = ?', [s.ref]);
  if (!order) return { ok: false, reason: 'order_not_found' };
  if (order.payment_method !== 'stripe') return { ok: false, reason: 'not_stripe_order' };
  if (s.paymentStatus !== 'paid') return { ok: false, reason: 'not_paid' };
  if (s.currency.toLowerCase() !== 'eur' || s.amountTotal !== order.total_cents) {
    await addEvent(order.id, 'system', 'amount_mismatch', null, null, `Stripe ${s.amountTotal} ${s.currency} ≠ pedido ${order.total_cents} EUR`);
    return { ok: false, reason: 'amount_mismatch' };
  }
  if (order.status !== 'pending') return { ok: true, reason: 'already_processed' };
  await run('UPDATE orders SET stripe_session_id = ?, stripe_payment_intent = ? WHERE id = ?', [s.sessionId, s.paymentIntent, order.id]);
  const updated = await changeStatus(order.id, 'paid', 'stripe', `Pago confirmado por webhook (${s.paymentIntent ?? s.sessionId})`);
  notifyPaid(updated).catch((e) => log.error('order.notifyPaid', e));
  return { ok: true, reason: 'paid' };
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
  await sendMail({
    to: config.mail.sales,
    replyTo: o.email,
    subject: `Nuevo pedido ${o.ref} (${o.payment_method === 'stripe' ? 'tarjeta' : 'proforma'}) — ${formatMoney(o.total_cents, 'es')}`,
    text: `${textTable(customerRows(o))}\n\n${textTable(summaryRows({ ...o, locale: 'es' }, items))}`,
    html: layout('Nuevo pedido', `<p>Nuevo pedido <strong>${esc(o.ref)}</strong> · ${o.payment_method === 'stripe' ? 'pago con tarjeta pendiente de confirmación' : 'requiere enviar factura proforma'}.</p>${table(customerRows(o))}${table(summaryRows({ ...o, locale: 'es' }, items))}<p><a href="${esc(config.siteUrl)}/admin/pedidos/${o.id}">Abrir en el panel</a></p>`),
    template: 'order-created-sales',
    related: o.ref,
  });
  await pushToCrm('order', {
    ref: o.ref, status: o.status, paymentMethod: o.payment_method, totalCents: o.total_cents, currency: 'EUR',
    customer: { name: o.customer_name, company: o.company, email: o.email, phone: o.phone, country: o.country },
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
    subject: `Pago confirmado ${o.ref} — ${formatMoney(o.total_cents, 'es')}`,
    text: `Stripe confirmó el pago del pedido ${o.ref}.`,
    html: layout('Pago confirmado', `<p>Stripe confirmó el pago del pedido <strong>${esc(o.ref)}</strong>.</p><p><a href="${esc(config.siteUrl)}/admin/pedidos/${o.id}">Abrir en el panel</a></p>`),
    template: 'order-paid-sales',
    related: o.ref,
  });
}

async function notifyStatus(o: OrderRow) {
  const L = o.locale;
  const label = t(L, `status.${o.status}` as any);
  const subject = L === 'es' ? `Pedido ${o.ref}: ${label}` : `Order ${o.ref}: ${label}`;
  const body = L === 'es' ? `El estado de su pedido ${o.ref} ha cambiado a: ${label}.` : `The status of your order ${o.ref} is now: ${label}.`;
  await sendMail({ to: o.email, subject, text: body, html: layout(subject, `<p>${esc(body)}</p>`), template: `order-${o.status}`, related: o.ref });
}
