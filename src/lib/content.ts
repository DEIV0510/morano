// Textos del sitio = valores por defecto (copy.ts) + cambios guardados en el panel.
import { all, run } from './db.ts';
import { COPY_KEYS, defaults, type CopyMap } from './copy.ts';
import type { Locale } from './i18n.ts';

const TTL = 10_000;
const cache = new Map<Locale, { at: number; map: CopyMap }>();

export async function getCopy(locale: Locale): Promise<CopyMap> {
  const hit = cache.get(locale);
  if (hit && Date.now() - hit.at < TTL) return hit.map;
  const map = defaults(locale);
  const rows = await all<{ key: string; value: string }>('SELECT key, value FROM content WHERE locale = ?', [locale]);
  for (const r of rows) if (COPY_KEYS.has(r.key) && r.value.trim()) map[r.key] = r.value;
  cache.set(locale, { at: Date.now(), map });
  return map;
}

export async function saveCopy(locale: Locale, values: Record<string, string>, userId: number) {
  const base = defaults(locale);
  for (const [key, raw] of Object.entries(values)) {
    if (!COPY_KEYS.has(key)) continue;
    const value = raw.replace(/\r\n?/g, '\n').trim().slice(0, 2000);
    if (!value || value === base[key]) {
      await run('DELETE FROM content WHERE key = ? AND locale = ?', [key, locale]);
    } else {
      await run(
        `INSERT INTO content (key, locale, value, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(key, locale) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
        [key, locale, value, Date.now(), userId]
      );
    }
  }
  cache.delete(locale);
}

export function invalidateCopy() {
  cache.clear();
}
