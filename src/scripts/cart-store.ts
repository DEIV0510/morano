// Carrito persistente en el navegador. Solo guarda identificadores de
// presentación y cantidades: los precios siempre vienen del servidor.
import { postJson } from './shared.ts';

export interface CartItem {
  variantId: number;
  qty: number;
}

export interface PricedLine {
  variantId: number;
  productSlug: string;
  productCode: string;
  productName: string;
  variantLabel: string;
  qty: number;
  maxQty: number | null;
  unit: string;
  total: string;
}

export interface PricedResponse {
  ok: boolean;
  lines: PricedLine[];
  issues: { variantId: number; reason: string }[];
  totals: { subtotal: string; shipping: string | null; shippingFree: boolean; vat: string; vatIncluded: boolean; vatRate: string; total: string };
  paymentMode: 'stripe' | 'proforma';
}

const KEY = 'morano_cart_v1';
const listeners = new Set<(items: CartItem[]) => void>();

export function load(): CartItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((i) => Number.isInteger(i?.variantId) && i.variantId > 0 && Number.isInteger(i?.qty) && i.qty > 0)
      .map((i) => ({ variantId: i.variantId, qty: Math.min(999, i.qty) }))
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

export function add(variantId: number, qty: number) {
  const items = load();
  const found = items.find((i) => i.variantId === variantId);
  if (found) found.qty = Math.min(999, found.qty + qty);
  else items.push({ variantId, qty });
  save(items);
}

export function setQty(variantId: number, qty: number) {
  const items = load()
    .map((i) => (i.variantId === variantId ? { ...i, qty } : i))
    .filter((i) => i.qty > 0);
  save(items);
}

export function remove(variantId: number) {
  save(load().filter((i) => i.variantId !== variantId));
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
  const synced = data.lines.map((l) => ({ variantId: l.variantId, qty: l.qty }));
  const changed = JSON.stringify(synced) !== JSON.stringify(items);
  if (changed) save(synced);
  return data;
}
