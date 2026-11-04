// Middleware global:
// 1) Cabeceras de seguridad (CSP estricta, HSTS, anti-clickjacking…).
// 2) Protección de /admin: sesión obligatoria, MFA pendiente, cambio de
//    contraseña forzado. Los permisos por rol se comprueban además en cada página.
// 3) Política de caché por tipo de respuesta.
import { defineMiddleware } from 'astro:middleware';
import { COOKIE, loadSession } from './lib/auth.ts';
import { config } from './lib/config.ts';

const DEV = import.meta.env.DEV;

const CSP = [
  "default-src 'self'",
  DEV ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
  DEV ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
  "img-src 'self' data: blob:",
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
  if (path.startsWith('/admin') || path.startsWith('/api/')) {
    h.set('Cache-Control', 'no-store');
    if (path.startsWith('/admin')) h.set('X-Robots-Tag', 'noindex, nofollow');
  } else if (type.includes('text/html') && !h.has('Cache-Control')) {
    // Precios y existencias cambian desde el panel: el HTML siempre se revalida.
    h.set('Cache-Control', 'no-cache');
  }
  return res;
}

const PUBLIC_ADMIN = new Set(['/admin/login', '/admin/login/', '/admin/mfa', '/admin/mfa/']);

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;

  if (path === '/admin' || path.startsWith('/admin/')) {
    const token = ctx.cookies.get(COOKIE)?.value;
    const auth = await loadSession(token);
    ctx.locals.auth = auth ?? undefined;
    if (!PUBLIC_ADMIN.has(path)) {
      if (!auth) {
        const nextUrl = ctx.request.method === 'GET' ? `?next=${encodeURIComponent(path + ctx.url.search)}` : '';
        return secure(ctx.redirect(`/admin/login${nextUrl}`, 303), path);
      }
      if (auth.session.mfa_pending) return secure(ctx.redirect('/admin/mfa', 303), path);
      const allowedWhileForced = path.startsWith('/admin/cuenta') || path.startsWith('/admin/logout');
      if (auth.user.must_change_password && !allowedWhileForced) return secure(ctx.redirect('/admin/cuenta?forzado=1', 303), path);
    }
  }

  // Pantalla de carga solo en la primera portada vista de la sesión.
  if (ctx.request.method === 'GET' && (path === '/es/' || path === '/en/' || path === '/es' || path === '/en')) {
    ctx.locals.firstVisit = !ctx.cookies.has('me_intro');
    if (ctx.locals.firstVisit) ctx.cookies.set('me_intro', '1', { path: '/', httpOnly: true, sameSite: 'lax', secure: config.secureCookies });
  }

  const res = await next();
  return secure(res, path);
});
