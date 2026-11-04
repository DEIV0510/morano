// Lógica común de las API públicas: límite de peticiones y lectura del cuerpo
// (JSON desde el sitio o formulario clásico cuando no hay JavaScript).
import { ApiError, assertSameOrigin, clientIp, readJson } from './http.ts';
import { hashIp } from './security/crypto.ts';
import { consume, LIMITS } from './security/ratelimit.ts';

export async function guard(ctx: { request: Request; clientAddress?: string }, limit: keyof typeof LIMITS) {
  assertSameOrigin(ctx.request);
  const ip = clientIp(ctx);
  const [max, win] = LIMITS[limit];
  const r = await consume(`${limit}:${hashIp(ip)}`, max, win);
  if (!r.ok) throw new ApiError(429, 'rate_limited', 'Too many requests', { retryAfter: r.retryAfter });
  return ip;
}

/** JSON (fetch) o application/x-www-form-urlencoded (formulario sin JS). */
export async function readBody(request: Request): Promise<{ data: Record<string, unknown>; isForm: boolean }> {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
    const len = Number(request.headers.get('content-length') || 0);
    if (len > 64 * 1024) throw new ApiError(413, 'payload_too_large', 'Payload too large');
    const fd = await request.formData();
    const data: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      if (typeof v === 'string') data[k] = v;
    });
    data.consent = data.consent === '1' || data.consent === 'on';
    return { data, isForm: true };
  }
  return { data: (await readJson(request)) as Record<string, unknown>, isForm: false };
}
