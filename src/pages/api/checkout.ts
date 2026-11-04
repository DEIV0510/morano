// POST /api/checkout — crea el pedido con importes del servidor y devuelve a
// dónde ir: Stripe Checkout (pago con tarjeta) o la página del pedido (proforma).
import type { APIRoute } from 'astro';
import { ApiError, errorResponse, json, readJson } from '../../lib/http.ts';
import { guard } from '../../lib/public-api.ts';
import { createOrder } from '../../lib/orders.ts';
import { checkoutSchema, parse } from '../../lib/validation.ts';

export const POST: APIRoute = async (ctx) => {
  try {
    const ip = await guard(ctx, 'checkout');
    const body = await readJson(ctx.request, 24 * 1024);
    const input = parse(checkoutSchema, body);
    const result = await createOrder(input, ip);
    return json({ ok: true, ref: result.ref, method: result.method, redirect: result.redirect });
  } catch (err) {
    if (err instanceof ApiError && err.code === 'cart_changed') {
      return json({ ok: false, error: 'cart_changed' }, 409);
    }
    return errorResponse(err, 'api.checkout');
  }
};
