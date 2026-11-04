// Carrito persistente en el navegador (SKU y cantidades) y cálculo del total
// estimado con los precios publicados en src/data/catalogo.ts.
import { computeTotals, shippingFor } from '../lib/pricing.ts';
import { i18n } from './shared.ts';

export interface CartItem {
  sku: string;
  qty: number;
}

export interface Line {
  sku: string;
  name: string;
  label: string;
  qty: number;
  unitCents: number;
  lineCents: number;
}

const KEY = 'morano_cart_v2';
const listeners = new Set<(items: CartItem[]) => void>();

export function load(): CartItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const known = i18n().shop.items;
    return raw
      .filter((i) => typeof i?.sku === 'string' && known[i.sku] && Number.isInteger(i?.qty) && i.qty > 0)
      .map((i) => ({ sku: i.sku, qty: Math.min(999, i.qty) }))
      .slice(0, 20);
  } catch {
    return [];
  }
}

export function save(items: CartItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* almacenamiento no disponible (modo privado) */
  }
  listeners.forEach((fn) => fn(items));
}

export function onChange(fn: (items: CartItem[]) => void) {
  listeners.add(fn);
}

export function add(sku: string, qty: number) {
  const items = load();
  const found = items.find((i) => i.sku === sku);
  if (found) found.qty = Math.min(999, found.qty + qty);
  else items.push({ sku, qty });
  save(items);
}

export function setQty(sku: string, qty: number) {
  save(load().map((i) => (i.sku === sku ? { ...i, qty } : i)).filter((i) => i.qty > 0));
}

export function remove(sku: string) {
  save(load().filter((i) => i.sku !== sku));
}

export const count = (items = load()) => items.reduce((s, i) => s + i.qty, 0);

/** Líneas y totales del carrito (solo productos con precio publicado). */
export function priced() {
  const { items: shop, vatBp, vatIncluded, shipping, freeFrom } = i18n().shop;
  const lines: Line[] = load()
    .filter((i) => shop[i.sku])
    .map((i) => ({ sku: i.sku, name: shop[i.sku].n, label: shop[i.sku].l, qty: i.qty, unitCents: shop[i.sku].p, lineCents: shop[i.sku].p * i.qty }));
  const subtotal = lines.reduce((s, l) => s + l.lineCents, 0);
  const ship = lines.length ? shippingFor(subtotal, { shippingCents: shipping, freeShippingFromCents: freeFrom }) : null;
  const { vatCents, totalCents } = computeTotals(subtotal, ship, vatBp, vatIncluded);
  return { lines, subtotal, shipping: ship, vatCents, totalCents, vatBp, vatIncluded };
}
