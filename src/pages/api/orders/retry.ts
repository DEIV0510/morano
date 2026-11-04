// POST /api/orders/retry — nueva sesión de Stripe para un pedido pendiente.
// Requiere el enlace privado del pedido (token o sesión de Stripe asociada).
import type { APIRoute } from 'astro';
import { ApiError, errorResponse } from '../../../lib/http.ts';
import { guard } from '../../../lib/public-api.ts';
import { findOrderForCustomer, retryStripeSession } from '../../../lib/orders.ts';

export const POST: APIRoute = async (ctx) => {
  try {
    await guard(ctx, 'checkout');
    const fd = await ctx.request.formData();
    const ref = String(fd.get('ref') || '');
    const found = await findOrderForCustomer(ref, { token: String(fd.get('t') || '') || null, sessionId: String(fd.get('session_id') || '') || null });
    if (!found) throw new ApiError(404, 'not_found', 'Order not found');
    const url = await retryStripeSession(found.order);
    return ctx.redirect(url, 303);
  } catch (err) {
    return errorResponse(err, 'api.orders.retry');
  }
};
