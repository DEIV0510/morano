// Cálculo de importes. Se ejecuta SIEMPRE en el servidor con precios,
// existencias y ajustes de la base de datos: el navegador solo envía
// identificadores de presentación y cantidades.
import { all } from './db.ts';
import type { Locale } from './i18n.ts';
import type { Settings } from './settings.ts';
import type { CartInput } from './validation.ts';

export interface PricedLine {
  variantId: number;
  productId: number;
  productSlug: string;
  productCode: string;
  productName: string;
  variantLabel: string;
  sku: string;
  unitCents: number;
  qty: number;
  lineCents: number;
  maxQty: number | null;
}

export interface CartIssue {
  variantId: number;
  reason: 'unavailable' | 'no_price' | 'out_of_stock' | 'qty_reduced';
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

interface Row {
  variant_id: number;
  product_id: number;
  slug: string;
  code: string;
  kind: string;
  p_status: string;
  v_status: string;
  name_es: string;
  name_en: string;
  label_es: string;
  label_en: string;
  sku: string;
  price_cents: number | null;
  stock: number | null;
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

export async function priceCart(input: CartInput, settings: Settings, locale: Locale): Promise<PricedCart> {
  // Agrupa líneas repetidas de la misma presentación.
  const wanted = new Map<number, number>();
  for (const it of input.items) wanted.set(it.variantId, (wanted.get(it.variantId) ?? 0) + it.qty);

  const ids = [...wanted.keys()];
  const rows = ids.length
    ? await all<Row>(
        `SELECT v.id AS variant_id, p.id AS product_id, p.slug, p.code, p.kind, p.status AS p_status, v.status AS v_status,
                p.name_es, p.name_en, v.label_es, v.label_en, v.sku, v.price_cents, v.stock
         FROM variants v JOIN products p ON p.id = v.product_id
         WHERE v.id IN (${ids.map(() => '?').join(',')})`,
        ids
      )
    : [];
  const byId = new Map(rows.map((r) => [r.variant_id, r]));

  const lines: PricedLine[] = [];
  const issues: CartIssue[] = [];
  for (const [variantId, requested] of wanted) {
    const r = byId.get(variantId);
    if (!r || r.kind !== 'direct' || r.p_status !== 'active' || r.v_status !== 'active') {
      issues.push({ variantId, reason: 'unavailable' });
      continue;
    }
    if (r.price_cents === null || r.price_cents <= 0) {
      issues.push({ variantId, reason: 'no_price' });
      continue;
    }
    let qty = Math.min(requested, 999);
    if (r.stock !== null) {
      if (r.stock <= 0) {
        issues.push({ variantId, reason: 'out_of_stock' });
        continue;
      }
      if (qty > r.stock) {
        qty = r.stock;
        issues.push({ variantId, reason: 'qty_reduced' });
      }
    }
    lines.push({
      variantId,
      productId: r.product_id,
      productSlug: r.slug,
      productCode: r.code,
      productName: locale === 'es' ? r.name_es : r.name_en,
      variantLabel: locale === 'es' ? r.label_es : r.label_en,
      sku: r.sku,
      unitCents: r.price_cents,
      qty,
      lineCents: r.price_cents * qty,
      maxQty: r.stock,
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
