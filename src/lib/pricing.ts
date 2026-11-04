// Cálculo de importes. Se ejecuta SIEMPRE en el servidor con los precios de
// src/data/catalogo.ts y los ajustes de src/data/ajustes.ts: el navegador
// solo envía referencias (SKU) y cantidades.
import { CATALOGO, type ProductoDef } from '../data/catalogo.ts';
import { findVariant } from './catalog.ts';
import type { Locale } from './i18n.ts';
import { euros, type Settings } from './settings.ts';
import type { CartInput } from './validation.ts';

export interface PricedLine {
  sku: string;
  productSlug: string;
  productCode: string;
  productName: string;
  variantLabel: string;
  unitCents: number;
  qty: number;
  lineCents: number;
}

export interface CartIssue {
  sku: string;
  reason: 'unavailable' | 'no_price';
}

export interface PricedCart {
  lines: PricedLine[];
  issues: CartIssue[];
  subtotalCents: number;
  shippingCents: number | null; // null = se confirma con la proforma
  vatRateBp: number;
  vatIncluded: boolean;
  vatCents: number;
  totalCents: number;
  currency: 'EUR';
}

/** IVA sobre una base, redondeo al céntimo (half-up). */
export function computeTotals(subtotal: number, shipping: number | null, rateBp: number, included: boolean) {
  const base = subtotal + (shipping ?? 0);
  if (included) {
    const vat = Math.round((base * rateBp) / (10_000 + rateBp));
    return { vatCents: vat, totalCents: base };
  }
  const vat = Math.round((base * rateBp) / 10_000);
  return { vatCents: vat, totalCents: base + vat };
}

export function shippingFor(subtotal: number, s: Pick<Settings, 'shippingCents' | 'freeShippingFromCents'>): number | null {
  if (s.shippingCents === null || s.shippingCents === undefined) return null;
  if (s.freeShippingFromCents !== null && s.freeShippingFromCents !== undefined && subtotal >= s.freeShippingFromCents) return 0;
  return s.shippingCents;
}

export function priceCart(input: CartInput, settings: Settings, locale: Locale, catalog: ProductoDef[] = CATALOGO): PricedCart {
  // Agrupa líneas repetidas de la misma presentación.
  const wanted = new Map<string, number>();
  for (const it of input.items) wanted.set(it.sku, Math.min(999, (wanted.get(it.sku) ?? 0) + it.qty));

  const lines: PricedLine[] = [];
  const issues: CartIssue[] = [];
  for (const [sku, qty] of wanted) {
    const found = findVariant(sku, catalog);
    if (!found || found.product.kind !== 'direct') {
      issues.push({ sku, reason: 'unavailable' });
      continue;
    }
    const unit = euros(found.variant.precio);
    if (!unit || unit <= 0) {
      issues.push({ sku, reason: 'no_price' });
      continue;
    }
    lines.push({
      sku,
      productSlug: found.product.slug,
      productCode: found.product.code,
      productName: found.product.name[locale],
      variantLabel: found.variant.etiqueta,
      unitCents: unit,
      qty,
      lineCents: unit * qty,
    });
  }

  const subtotalCents = lines.reduce((s, l) => s + l.lineCents, 0);
  const shippingCents = lines.length ? shippingFor(subtotalCents, settings) : null;
  const { vatCents, totalCents } = computeTotals(subtotalCents, shippingCents, settings.vatRateBp, settings.pricesIncludeVat);
  return {
    lines,
    issues,
    subtotalCents,
    shippingCents,
    vatRateBp: settings.vatRateBp,
    vatIncluded: settings.pricesIncludeVat,
    vatCents,
    totalCents,
    currency: 'EUR',
  };
}

export function formatMoney(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
