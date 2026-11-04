// Middleware global:
// 1) Cabeceras de seguridad (CSP estricta, HSTS, anti-clickjacking…).
// 2) Política de caché por tipo de respuesta.
// 3) Cookie de la pantalla de carga (solo la primera portada de la sesión).
import { defineMiddleware } from 'astro:middleware';
import { config } from './lib/config.ts';

const DEV = import.meta.env.DEV;

const CSP = [
  "default-src 'self'",
  DEV ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
  DEV ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  DEV ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
  "media-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com",
  "base-uri 'none'",
  "object-src 'none'",
  "manifest-src 'self'",
  "worker-src 'none'",
  ...(config.secureCookies ? ['upgrade-insecure-requests'] : []),
].join('; ');

function secure(res: Response, path: string): Response {
  const h = res.headers;
  h.set('Content-Security-Policy', CSP);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  h.set('X-Permitted-Cross-Domain-Policies', 'none');
  h.set('Origin-Agent-Cluster', '?1');
  if (config.secureCookies) h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  h.delete('X-Powered-By');

  const type = h.get('content-type') || '';
  if (path.startsWith('/api/')) {
    h.set('Cache-Control', 'no-store');
  } else if (type.includes('text/html') && !h.has('Cache-Control')) {
    // El HTML siempre se revalida (los pedidos y formularios llevan tokens de un solo uso).
    h.set('Cache-Control', 'no-cache');
  }
  return res;
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;

  if (ctx.request.method === 'GET' && (path === '/es/' || path === '/en/' || path === '/es' || path === '/en')) {
    ctx.locals.firstVisit = !ctx.cookies.has('me_intro');
    if (ctx.locals.firstVisit) ctx.cookies.set('me_intro', '1', { path: '/', httpOnly: true, sameSite: 'lax', secure: config.secureCookies });
  }

  const res = await next();
  return secure(res, path);
});
