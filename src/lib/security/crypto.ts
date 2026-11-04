// Primitivas criptográficas con node:crypto (sin dependencias externas).
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
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

// ── Contraseñas: scrypt (memory-hard), parámetros OWASP: N=2^17, r=8, p=1 ──
const SCRYPT = { N: 2 ** 17, r: 8, p: 1, keylen: 32, maxmem: 256 * 1024 * 1024 };

function scryptAsync(pw: string, salt: Buffer, p = SCRYPT): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(pw.normalize('NFKC'), salt, p.keylen, { N: p.N, r: p.r, p: p.p, maxmem: p.maxmem }, (e, k) =>
      e ? reject(e) : resolve(k)
    )
  );
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pw, salt);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scryptAsync(pw, Buffer.from(saltB64, 'base64'), {
    ...SCRYPT,
    N: Number(N),
    r: Number(r),
    p: Number(p),
    keylen: expected.length,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Hash ficticio para igualar tiempos cuando el usuario no existe. */
let dummy: Promise<string> | undefined;
export const dummyHash = () => (dummy ??= hashPassword(randomToken(16)));

// ── Cifrado en reposo (AES-256-GCM) para secretos MFA ──
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', subkey('mfa-secret'), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64url')}.${enc.toString('base64url')}.${c.getAuthTag().toString('base64url')}`;
}

export function decrypt(payload: string): string {
  const [v, iv, enc, tag] = payload.split('.');
  if (v !== 'v1') throw new Error('Formato de cifrado desconocido');
  const d = createDecipheriv('aes-256-gcm', subkey('mfa-secret'), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8');
}

/** Referencia legible y no secuencial (no revela volumen de pedidos). */
export function publicRef(prefix: string): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(7);
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  const yy = String(new Date().getUTCFullYear()).slice(2);
  return `${prefix}-${yy}-${s}`;
}
