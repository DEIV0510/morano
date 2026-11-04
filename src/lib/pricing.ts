// Cálculo de importes del carrito (estimación: el pedido se confirma por WhatsApp).
import type { Locale } from './i18n.ts';

/** IVA sobre una base, redondeo al céntimo. */
export function computeTotals(subtotal: number, shipping: number | null, rateBp: number, included: boolean) {
  const base = subtotal + (shipping ?? 0);
  if (included) {
    const vat = Math.round((base * rateBp) / (10_000 + rateBp));
    return { vatCents: vat, totalCents: base };
  }
  const vat = Math.round((base * rateBp) / 10_000);
  return { vatCents: vat, totalCents: base + vat };
}

export function shippingFor(subtotal: number, s: { shippingCents: number | null; freeShippingFromCents: number | null }): number | null {
  if (s.shippingCents === null) return null;
  if (s.freeShippingFromCents !== null && subtotal >= s.freeShippingFromCents) return 0;
  return s.shippingCents;
}

export function formatMoney(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
