// Catálogo: productos, presentaciones (variantes) e imágenes.
import { all, get } from './db.ts';
import type { Locale } from './i18n.ts';

export interface ProductRow {
  id: number;
  slug: string;
  code: string;
  kind: 'direct' | 'quote';
  status: 'active' | 'inactive' | 'archived';
  sort: number;
  name_es: string;
  name_en: string;
  subtitle_es: string;
  subtitle_en: string;
  description_es: string;
  description_en: string;
  features_es: string;
  features_en: string;
  applications_es: string;
  applications_en: string;
  photo: string | null;
  created_at: number;
  updated_at: number;
}

export interface VariantRow {
  id: number;
  product_id: number;
  sku: string;
  label_es: string;
  label_en: string;
  grams: number;
  price_cents: number | null;
  stock: number | null;
  low_stock_threshold: number | null;
  status: 'active' | 'inactive';
  sort: number;
}

export interface ImageRow {
  id: number;
  product_id: number;
  media_id: string;
  alt_es: string;
  alt_en: string;
  sort: number;
  width: number;
  height: number;
  color: string | null;
}

export interface Product {
  id: number;
  slug: string;
  code: string;
  kind: 'direct' | 'quote';
  status: string;
  name: string;
  subtitle: string;
  description: string;
  features: string[];
  applications: string[];
  photo: string | null;
  images: { mediaId: string; alt: string; width: number; height: number }[];
  variants: {
    id: number;
    sku: string;
    label: string;
    grams: number;
    priceCents: number | null;
    available: boolean;
    stock: number | null;
    lowStock: boolean;
  }[];
}

export const listJson = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : [];
  } catch {
    return [];
  }
};

export function localize(p: ProductRow, variants: VariantRow[], images: ImageRow[], locale: Locale, lowStockDefault = 5): Product {
  const L = locale;
  return {
    id: p.id,
    slug: p.slug,
    code: p.code,
    kind: p.kind,
    status: p.status,
    name: p[`name_${L}`],
    subtitle: p[`subtitle_${L}`],
    description: p[`description_${L}`],
    features: listJson(p[`features_${L}`]),
    applications: listJson(p[`applications_${L}`]),
    photo: p.photo,
    images: images
      .filter((i) => i.product_id === p.id)
      .map((i) => ({ mediaId: i.media_id, alt: i[`alt_${L}`] || p[`name_${L}`], width: i.width, height: i.height })),
    variants: variants
      .filter((v) => v.product_id === p.id && v.status === 'active')
      .map((v) => ({
        id: v.id,
        sku: v.sku,
        label: v[`label_${L}`],
        grams: v.grams,
        priceCents: v.price_cents,
        stock: v.stock,
        available: v.stock === null || v.stock > 0,
        lowStock: v.stock !== null && v.stock > 0 && v.stock <= (v.low_stock_threshold ?? lowStockDefault),
      })),
  };
}

export async function publicCatalog(locale: Locale, lowStockDefault = 5): Promise<Product[]> {
  const products = await all<ProductRow>("SELECT * FROM products WHERE status = 'active' ORDER BY sort, id");
  const variants = await all<VariantRow>('SELECT * FROM variants ORDER BY sort, grams, id');
  const images = await all<ImageRow>(
    `SELECT pi.*, m.width, m.height, m.color FROM product_images pi JOIN media m ON m.id = pi.media_id ORDER BY pi.sort, pi.id`
  );
  return products.map((p) => localize(p, variants, images, locale, lowStockDefault));
}

export async function productBySlug(slug: string, locale: Locale, lowStockDefault = 5): Promise<Product | undefined> {
  const p = await get<ProductRow>("SELECT * FROM products WHERE slug = ? AND status = 'active'", [slug]);
  if (!p) return undefined;
  const variants = await all<VariantRow>('SELECT * FROM variants WHERE product_id = ? ORDER BY sort, grams, id', [p.id]);
  const images = await all<ImageRow>(
    `SELECT pi.*, m.width, m.height, m.color FROM product_images pi JOIN media m ON m.id = pi.media_id WHERE pi.product_id = ? ORDER BY pi.sort, pi.id`,
    [p.id]
  );
  return localize(p, variants, images, locale, lowStockDefault);
}

/** Productos que se pueden elegir en el formulario de cotización. */
export async function quotableProducts(locale: Locale) {
  const rows = await all<{ slug: string; code: string; name_es: string; name_en: string }>(
    "SELECT slug, code, name_es, name_en FROM products WHERE status = 'active' ORDER BY kind = 'direct', sort, id"
  );
  return rows.map((r) => ({ slug: r.slug, code: r.code, name: locale === 'es' ? r.name_es : r.name_en }));
}

export async function productExists(slug: string): Promise<boolean> {
  if (!/^[a-z0-9-]{2,64}$/.test(slug)) return false;
  return Boolean(await get("SELECT 1 AS x FROM products WHERE slug = ? AND status = 'active'", [slug]));
}
