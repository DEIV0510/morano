// Integración con Stripe Checkout mediante su API REST (sin SDK).
// - Los datos de tarjeta solo los maneja Stripe (página alojada).
// - El importe se calcula en el servidor y se verifica de nuevo en el webhook.
// - El pago se confirma SOLO con el webhook firmado, nunca con la redirección.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config, stripeConfigured } from '../config.ts';
import type { Locale } from '../i18n.ts';
import { route } from '../i18n.ts';

const API = 'https://api.stripe.com/v1';

export interface SessionLine {
  name: string;
  unitCents: number;
  qty: number;
}

function form(params: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.append(k, String(v));
  return u.toString();
}

async function stripeFetch(path: string, body: string, idempotencyKey: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.stripe.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': idempotencyKey,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as any;
  if (!res.ok) {
    // No se registra la clave ni el cuerpo completo: solo el tipo de error.
    throw new Error(`Stripe ${res.status}: ${data?.error?.type ?? 'error'} ${data?.error?.code ?? ''}`.trim());
  }
  return data;
}

export async function createCheckoutSession(opts: {
  orderRef: string;
  attempt: number;
  locale: Locale;
  email: string;
  lines: SessionLine[];
  totalCents: number;
}): Promise<{ id: string; url: string }> {
  if (!stripeConfigured()) throw new Error('Stripe no está configurado');
  const sum = opts.lines.reduce((s, l) => s + l.unitCents * l.qty, 0);
  if (sum !== opts.totalCents) throw new Error('Las líneas no suman el total del pedido');

  const back = `${config.siteUrl}${route('order', opts.locale, encodeURIComponent(opts.orderRef))}`;
  const params: Record<string, string | number | undefined> = {
    mode: 'payment',
    locale: opts.locale,
    customer_email: opts.email,
    client_reference_id: opts.orderRef,
    'metadata[order_ref]': opts.orderRef,
    'payment_intent_data[metadata][order_ref]': opts.orderRef,
    success_url: `${back}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${back}?session_id={CHECKOUT_SESSION_ID}&cancelled=1`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 2,
  };
  opts.lines.forEach((l, i) => {
    params[`line_items[${i}][quantity]`] = l.qty;
    params[`line_items[${i}][price_data][currency]`] = 'eur';
    params[`line_items[${i}][price_data][unit_amount]`] = l.unitCents;
    params[`line_items[${i}][price_data][product_data][name]`] = l.name.slice(0, 250);
  });
  const s = await stripeFetch('/checkout/sessions', form(params), `checkout-${opts.orderRef}-${opts.attempt}`);
  return { id: s.id, url: s.url };
}

/**
 * Verifica la cabecera Stripe-Signature (HMAC-SHA256 de "t.payload") con
 * tolerancia de 5 minutos para impedir reenvíos.
 */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  let t = '';
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=', 2).map((s) => s?.trim());
    if (k === 't') t = v ?? '';
    if (k === 'v1' && v) v1.push(v);
  }
  if (!/^\d+$/.test(t) || !v1.length) return false;
  if (Math.abs(nowSec - Number(t)) > toleranceSec) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex'));
  return v1.some((sig) => {
    const b = Buffer.from(sig);
    return b.length === expected.length && timingSafeEqual(b, expected);
  });
}
