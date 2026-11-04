// Carrito persistente en el navegador. Solo guarda identificadores de
// presentación y cantidades: los precios siempre vienen del servidor.
import { postJson } from './shared.ts';

export interface CartItem {
  sku: string;
  qty: number;
}

export interface PricedLine {
  sku: string;
  productSlug: string;
  productCode: string;
  productName: string;
  variantLabel: string;
  qty: number;
  unit: string;
  total: string;
}

export interface PricedResponse {
  ok: boolean;
  lines: PricedLine[];
  issues: { sku: string; reason: string }[];
  totals: { subtotal: string; shipping: string | null; shippingFree: boolean; vat: string; vatIncluded: boolean; vatRate: string; total: string };
  paymentMode: 'stripe' | 'proforma';
}

const KEY = 'morano_cart_v2';
const listeners = new Set<(items: CartItem[]) => void>();

export function load(): CartItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((i) => typeof i?.sku === 'string' && /^[A-Z0-9-]{2,40}$/.test(i.sku) && Number.isInteger(i?.qty) && i.qty > 0)
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
    /* almacenamiento no disponible (modo privado): el carrito vive en memoria */
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
  const items = load()
    .map((i) => (i.sku === sku ? { ...i, qty } : i))
    .filter((i) => i.qty > 0);
  save(items);
}

export function remove(sku: string) {
  save(load().filter((i) => i.sku !== sku));
}

export function clear() {
  save([]);
}

export const count = (items = load()) => items.reduce((s, i) => s + i.qty, 0);

/** Pide al servidor el carrito con precios y lo sincroniza con lo que realmente se puede comprar. */
export async function price(locale: string): Promise<PricedResponse | null> {
  const items = load();
  const { status, data } = await postJson<PricedResponse>('/api/cart', { items, locale });
  if (status !== 200 || !data?.ok) return null;
  const synced = data.lines.map((l) => ({ sku: l.sku, qty: l.qty }));
  const changed = JSON.stringify(synced) !== JSON.stringify(items);
  if (changed) save(synced);
  return data;
}
