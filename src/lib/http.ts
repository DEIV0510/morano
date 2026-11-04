// Utilidades HTTP compartidas por los endpoints: respuestas JSON, errores
// centralizados, IP del cliente y verificación de mismo origen.
import { config } from './config.ts';
import { log } from './log.ts';

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  retryAfter?: number;
  constructor(status: number, code: string, message = code, extra: { fields?: Record<string, string>; retryAfter?: number } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = extra.fields;
    this.retryAfter = extra.retryAfter;
  }
}

const baseHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...baseHeaders, ...headers } });
}

/** Convierte cualquier error en una respuesta segura (sin trazas internas). */
export function errorResponse(err: unknown, where: string): Response {
  if (err instanceof ApiError) {
    const headers: Record<string, string> = {};
    if (err.retryAfter) headers['Retry-After'] = String(err.retryAfter);
    return json({ ok: false, error: err.code, message: err.message, fields: err.fields }, err.status, headers);
  }
  log.error(where, err);
  return json({ ok: false, error: 'server_error', message: 'Internal error' }, 500);
}

export function handler(where: string, fn: (ctx: any) => Promise<Response>) {
  return async (ctx: any) => {
    try {
      return await fn(ctx);
    } catch (err) {
      return errorResponse(err, where);
    }
  };
}

/** IP del cliente. Solo se confía en X-Forwarded-For si hay un proxy de confianza. */
export function clientIp(ctx: { request: Request; clientAddress?: string }): string {
  if (config.trustProxy) {
    const cf = ctx.request.headers.get('cf-connecting-ip');
    if (cf) return cf.trim();
    const xff = ctx.request.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
  }
  try {
    return ctx.clientAddress || '0.0.0.0';
  } catch {
    return '0.0.0.0';
  }
}

/**
 * Las API JSON solo aceptan peticiones del propio sitio. Sin cabeceras CORS,
 * el navegador tampoco deja leer las respuestas desde otro origen.
 */
export function assertSameOrigin(request: Request) {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') throw new ApiError(403, 'cross_origin', 'Forbidden');
  const origin = request.headers.get('origin');
  if (origin) {
    const self = new URL(request.url).origin;
    if (origin !== self && origin !== config.siteUrl) throw new ApiError(403, 'cross_origin', 'Forbidden');
  }
}

/** Lee un cuerpo JSON con límite de tamaño. */
export async function readJson(request: Request, maxBytes = 32 * 1024): Promise<unknown> {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new ApiError(415, 'unsupported_media_type', 'JSON expected');
  const len = Number(request.headers.get('content-length') || 0);
  if (len > maxBytes) throw new ApiError(413, 'payload_too_large', 'Payload too large');
  const text = await request.text();
  if (text.length > maxBytes) throw new ApiError(413, 'payload_too_large', 'Payload too large');
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'invalid_json', 'Invalid JSON');
  }
}
