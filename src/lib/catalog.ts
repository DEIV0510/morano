// Catálogo localizado a partir de src/data/catalogo.ts.
import { CATALOGO, type ProductoDef } from '../data/catalogo.ts';
import type { Locale } from './i18n.ts';
import { euros } from './settings.ts';

export interface Product {
  slug: string;
  code: string;
  kind: 'direct' | 'quote';
  name: string;
  subtitle: string;
  description: string;
  features: string[];
  applications: string[];
  photo: string | null;
  variants: {
    sku: string;
    label: string;
    grams: number;
    priceCents: number | null;
  }[];
}

export function localize(p: ProductoDef, locale: Locale): Product {
  return {
    slug: p.slug,
    code: p.code,
    kind: p.kind,
    name: p.name[locale],
    subtitle: p.subtitle[locale],
    description: p.description[locale],
    features: p.features[locale],
    applications: p.applications[locale],
    photo: p.photo ?? null,
    variants: (p.presentaciones ?? []).map((v) => ({ sku: v.sku, label: v.etiqueta, grams: v.gramos, priceCents: euros(v.precio) })),
  };
}

export async function publicCatalog(locale: Locale): Promise<Product[]> {
  return CATALOGO.map((p) => localize(p, locale));
}

export async function productBySlug(slug: string, locale: Locale): Promise<Product | undefined> {
  const p = CATALOGO.find((x) => x.slug === slug);
  return p ? localize(p, locale) : undefined;
}

export async function productExists(slug: string): Promise<boolean> {
  return CATALOGO.some((p) => p.slug === slug);
}

/** Productos que se pueden elegir en el formulario de cotización (primero los de cotización). */
export async function quotableProducts(locale: Locale) {
  return [...CATALOGO]
    .sort((a, b) => Number(a.kind === 'direct') - Number(b.kind === 'direct'))
    .map((p) => ({ slug: p.slug, code: p.code, name: p.name[locale] }));
}

/** Búsqueda de una presentación por SKU (para precios y pedidos). */
export function findVariant(sku: string, catalog: ProductoDef[] = CATALOGO) {
  for (const p of catalog) {
    const v = p.presentaciones?.find((x) => x.sku === sku);
    if (v) return { product: p, variant: v };
  }
  return undefined;
}
