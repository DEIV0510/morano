// Primitivas criptográficas con node:crypto (sin dependencias externas).
import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config.ts';

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export const hmac = (key: string | Buffer, data: string) =>
  createHmac('sha256', key).update(data).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba); // tiempo constante también cuando la longitud difiere
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/** Clave derivada del secreto de la app para un propósito concreto. */
function subkey(purpose: string): Buffer {
  return Buffer.from(hkdfSync('sha256', config.appSecret, 'morano-europe', purpose, 32));
}

/** IP seudonimizada (RGPD): permite limitar abusos sin guardar la IP real. */
export const hashIp = (ip: string) => hmac(subkey('ip'), ip).slice(0, 32);

export const sign = (data: string, purpose: string) => hmac(subkey(purpose), data);

/** Referencia legible y no secuencial (no revela volumen de pedidos). */
export function publicRef(prefix: string): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(7);
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  const yy = String(new Date().getUTCFullYear()).slice(2);
  return `${prefix}-${yy}-${s}`;
}
