// Utilidades de las páginas del panel: permisos, CSRF, formularios, paginación.
// Cada página llama a guard() con su permiso: ocultar un botón NUNCA basta.
import type { AstroGlobal } from 'astro';
import { can, checkCsrf, type AdminUser, type Permission, type SessionRow } from './auth.ts';
import { clientIp } from './http.ts';
import { hashIp } from './security/crypto.ts';
import { consume, LIMITS } from './security/ratelimit.ts';
import { audit } from './audit.ts';

export interface Guarded {
  user: AdminUser;
  session: SessionRow;
  ipHash: string;
}

export function guard(Astro: AstroGlobal, perm: Permission): Guarded | Response {
  const auth = Astro.locals.auth;
  if (!auth || auth.session.mfa_pending) return Astro.redirect('/admin/login', 303);
  if (!can(auth.user.role, perm)) {
    return new Response(forbiddenHtml(), { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return { user: auth.user, session: auth.session, ipHash: hashIp(clientIp(Astro as any)) };
}

function forbiddenHtml() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sin permiso</title><link rel="stylesheet" href="/admin-fallback.css"></head><body><main class="fallback"><h1>Sin permiso</h1><p>Su rol no permite acceder a esta sección.</p><p><a href="/admin">Volver al panel</a></p></main></body></html>`;
}

export class FormError extends Error {}

/** Lee un formulario del panel verificando el token CSRF y el límite de escritura. */
export async function readForm(Astro: AstroGlobal, g: Guarded): Promise<FormData> {
  const fd = await Astro.request.formData();
  if (!checkCsrf(g.session, fd.get('_csrf'))) {
    await audit(g.user, 'csrf.rejected', undefined, undefined, { path: Astro.url.pathname }, g.ipHash);
    throw new FormError('La sesión del formulario ha caducado. Recargue la página e inténtelo de nuevo.');
  }
  const rl = await consume(`admin:${g.user.id}`, LIMITS.adminWrite[0], LIMITS.adminWrite[1]);
  if (!rl.ok) throw new FormError('Demasiadas operaciones seguidas. Espere unos minutos.');
  return fd;
}

export const str = (fd: FormData, k: string, max = 2000) => String(fd.get(k) ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
export const lines = (fd: FormData, k: string) =>
  str(fd, k, 4000)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);

/** "12,50" o "12.50" → 1250 céntimos. Vacío → null. Lanza si es inválido. */
export function parseEuros(raw: string): number | null {
  const s = raw.trim().replace(/\s|€/g, '');
  if (!s) return null;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) throw new FormError(`Importe no válido: ${raw}`);
  const cents = Math.round(Number(normalized) * 100);
  if (cents <= 0) throw new FormError('El importe debe ser mayor que cero.');
  return cents;
}

export function parseIntOrNull(raw: string, min = 0, max = 1_000_000): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (!/^\d+$/.test(s)) throw new FormError(`Número no válido: ${raw}`);
  const n = Number(s);
  if (n < min || n > max) throw new FormError(`Valor fuera de rango: ${raw}`);
  return n;
}

export const centsToInput = (c: number | null | undefined) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));

export function pageParams(url: URL, size = 20) {
  const page = Math.max(1, Math.min(10_000, Number(url.searchParams.get('p')) || 1));
  return { page, size, offset: (page - 1) * size };
}

export function qs(url: URL, patch: Record<string, string | number | null>) {
  const u = new URLSearchParams(url.search);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === '') u.delete(k);
    else u.set(k, String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : '';
}

/** Patrón LIKE seguro (escapa comodines del usuario). */
export const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export const fmtDate = (ms: number | null | undefined, withTime = true) =>
  ms
    ? new Date(ms).toLocaleString('es-ES', {
        timeZone: 'Europe/Madrid',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : '—';

export const ORDER_LABEL: Record<string, string> = {
  pending: 'Pendiente de pago',
  paid: 'Pagado',
  processing: 'En preparación',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};
export const QUOTE_LABEL: Record<string, string> = {
  new: 'Nueva',
  in_progress: 'En gestión',
  quoted: 'Cotizada',
  won: 'Ganada',
  lost: 'Perdida',
  archived: 'Archivada',
};
export const MESSAGE_LABEL: Record<string, string> = {
  new: 'Nuevo',
  read: 'Leído',
  replied: 'Respondido',
  archived: 'Archivado',
};
