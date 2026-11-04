// POST /admin/logout — cierra la sesión (solo POST con token CSRF).
import type { APIRoute } from 'astro';
import { checkCsrf, COOKIE, cookieOptions, destroySession } from '../../lib/auth.ts';
import { audit } from '../../lib/audit.ts';

export const POST: APIRoute = async ({ request, cookies, locals, redirect }) => {
  const fd = await request.formData();
  const auth = locals.auth;
  if (auth && checkCsrf(auth.session, fd.get('_csrf'))) {
    await destroySession(cookies.get(COOKIE)?.value);
    await audit(auth.user, 'logout', 'user', auth.user.id);
  }
  cookies.delete(COOKIE, cookieOptions());
  return redirect('/admin/login', 303);
};

export const GET: APIRoute = ({ redirect }) => redirect('/admin', 303);
