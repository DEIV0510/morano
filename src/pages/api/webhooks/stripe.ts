// POST /api/webhooks/stripe — única fuente de verdad del pago.
// 1) Firma HMAC verificada sobre el cuerpo crudo (con tolerancia de 5 min).
// 2) Idempotencia por id de evento (Stripe reintenta entregas).
// 3) Importe y moneda contrastados con el pedido guardado.
import type { APIRoute } from 'astro';
import { config, stripeConfigured } from '../../../lib/config.ts';
import { get, run } from '../../../lib/db.ts';
import { json } from '../../../lib/http.ts';
import { log } from '../../../lib/log.ts';
import { securityAlert } from '../../../lib/alerts.ts';
import { confirmStripePayment, markRefunded, type OrderRow } from '../../../lib/orders.ts';
import { verifyStripeSignature } from '../../../lib/payments/stripe.ts';

export const POST: APIRoute = async ({ request }) => {
  if (!stripeConfigured()) return json({ ok: false, error: 'not_configured' }, 503);
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 512 * 1024) return json({ ok: false }, 413);
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get('stripe-signature'), config.stripe.webhookSecret)) {
    await securityAlert('stripe_bad_signature', { length: payload.length });
    return json({ ok: false, error: 'bad_signature' }, 400);
  }

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ ok: false }, 400);
  }
  if (typeof event?.id !== 'string' || typeof event?.type !== 'string') return json({ ok: false }, 400);

  // Evento ya procesado → 200 sin repetir efectos.
  const seen = await get('SELECT id FROM stripe_events WHERE id = ?', [event.id]);
  if (seen) return json({ ok: true, duplicate: true });

  const obj = event.data?.object ?? {};
  const ref: string | undefined = obj.metadata?.order_ref ?? obj.client_reference_id ?? undefined;
  let result: unknown = { ignored: true };

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        if (ref) {
          result = await confirmStripePayment({
            ref,
            sessionId: obj.id,
            paymentIntent: typeof obj.payment_intent === 'string' ? obj.payment_intent : obj.payment_intent?.id ?? null,
            amountTotal: Number(obj.amount_total),
            currency: String(obj.currency || ''),
            paymentStatus: String(obj.payment_status || ''),
          });
        }
        break;
      case 'checkout.session.async_payment_failed':
        if (ref) {
          const o = await get<OrderRow>('SELECT * FROM orders WHERE ref = ?', [ref]);
          if (o && o.status === 'pending') {
            await run("INSERT INTO order_events (order_id, at, actor, type, note) VALUES (?, ?, 'stripe', 'payment_failed', 'Pago asíncrono rechazado')", [o.id, Date.now()]);
          }
        }
        break;
      case 'charge.refunded':
        {
          const pi = typeof obj.payment_intent === 'string' ? obj.payment_intent : null;
          if (pi && obj.refunded === true) {
            const refunded = await markRefunded(pi);
            if (refunded) result = { refunded };
          }
        }
        break;
      default:
        break;
    }
    await run('INSERT OR IGNORE INTO stripe_events (id, type, received_at, order_ref) VALUES (?, ?, ?, ?)', [event.id, event.type, Date.now(), ref ?? null]);
    log.info('stripe.webhook', { type: event.type, ref, result });
    return json({ ok: true });
  } catch (err) {
    // 500 → Stripe reintentará la entrega más tarde.
    log.error('stripe.webhook', err);
    return json({ ok: false }, 500);
  }
};
