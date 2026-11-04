// Textos corporativos del sitio (se editan en src/lib/copy.ts).
import { defaults, type CopyMap } from './copy.ts';
import type { Locale } from './i18n.ts';

const cache: Partial<Record<Locale, CopyMap>> = {};

export async function getCopy(locale: Locale): Promise<CopyMap> {
  return (cache[locale] ??= defaults(locale));
}
