// Protección de formularios públicos contra bots, sin servicios de terceros:
// 1) campo trampa invisible, 2) token firmado con la hora de carga
// (un humano tarda más de unos segundos en rellenar), 3) límite de enlaces.
import { safeEqual, sign } from './crypto.ts';

const MIN_MS = 2_500;
const MAX_MS = 24 * 60 * 60 * 1000;

export function issueFormToken(now = Date.now()): string {
  const ts = String(now);
  return `${ts}.${sign(ts, 'form-token').slice(0, 32)}`;
}

export type SpamVerdict = { ok: true } | { ok: false; reason: 'honeypot' | 'token' | 'too-fast' | 'expired' | 'links' };

export function checkSpam(input: { honeypot?: unknown; token?: unknown; text?: string }, now = Date.now()): SpamVerdict {
  if (typeof input.honeypot === 'string' && input.honeypot.trim() !== '') return { ok: false, reason: 'honeypot' };
  const token = typeof input.token === 'string' ? input.token : '';
  const [ts, mac] = token.split('.');
  if (!ts || !mac || !/^\d{13}$/.test(ts) || !safeEqual(mac, sign(ts, 'form-token').slice(0, 32))) {
    return { ok: false, reason: 'token' };
  }
  const age = now - Number(ts);
  if (age < MIN_MS) return { ok: false, reason: 'too-fast' };
  if (age > MAX_MS) return { ok: false, reason: 'expired' };
  const links = (input.text ?? '').match(/https?:\/\/|www\./gi)?.length ?? 0;
  if (links > 3) return { ok: false, reason: 'links' };
  return { ok: true };
}
