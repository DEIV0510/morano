// Limitación de peticiones por clave (IP + endpoint, cuenta, etc.).
// Se guarda en la base de datos para que funcione con varias instancias o en
// serverless, donde la memoria del proceso no se comparte.
import { get, run } from '../db.ts';

export interface RateResult {
  ok: boolean;
  count: number;
  retryAfter: number; // segundos
}

export async function consume(key: string, limit: number, windowSec: number): Promise<RateResult> {
  const now = Date.now();
  const reset = now + windowSec * 1000;
  const row = await get<{ count: number; reset_at: number }>(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count    = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
       reset_at = CASE WHEN rate_limits.reset_at <= ? THEN excluded.reset_at ELSE rate_limits.reset_at END
     RETURNING count, reset_at`,
    [key, reset, now, now]
  );
  // Limpieza ocasional de ventanas caducadas.
  if (Math.random() < 0.02) await run('DELETE FROM rate_limits WHERE reset_at < ?', [now]);
  const count = row?.count ?? 1;
  const retryAfter = Math.max(1, Math.ceil(((row?.reset_at ?? reset) - now) / 1000));
  return { ok: count <= limit, count, retryAfter };
}

export async function peek(key: string): Promise<number> {
  const row = await get<{ count: number; reset_at: number }>('SELECT count, reset_at FROM rate_limits WHERE key = ?', [key]);
  if (!row || row.reset_at <= Date.now()) return 0;
  return row.count;
}

export async function clear(key: string) {
  await run('DELETE FROM rate_limits WHERE key = ?', [key]);
}

/** Límites por endpoint: [peticiones, ventana en segundos]. */
export const LIMITS = {
  quote: [5, 600],
  contact: [5, 600],
  checkout: [10, 600],
  cartQuote: [120, 60],
} as const satisfies Record<string, readonly [number, number]>;
