// Ajustes comerciales y legales editables desde el panel.
import { all, run } from './db.ts';

export interface Settings {
  vatRateBp: number; // IVA en puntos básicos (2100 = 21 %)
  pricesIncludeVat: boolean;
  shippingCents: number | null; // null = envío sin configurar → pedido con proforma
  freeShippingFromCents: number | null;
  cardPaymentsEnabled: boolean; // requiere además las claves de Stripe
  lowStockDefault: number;
  legalName: string;
  taxId: string; // NIF de la sociedad
  registry: string; // datos registrales (Registro Mercantil)
  publicEmail: string;
}

export const DEFAULT_SETTINGS: Settings = {
  vatRateBp: 2100,
  pricesIncludeVat: true,
  shippingCents: null,
  freeShippingFromCents: null,
  cardPaymentsEnabled: true,
  lowStockDefault: 5,
  legalName: 'MORANO EUROPE SL',
  taxId: '',
  registry: '',
  publicEmail: '',
};

let cached: { at: number; value: Settings } | undefined;

export async function getSettings(): Promise<Settings> {
  if (cached && Date.now() - cached.at < 10_000) return cached.value;
  const value: Settings = { ...DEFAULT_SETTINGS };
  const rows = await all<{ key: string; value: string }>('SELECT key, value FROM settings');
  for (const r of rows) {
    if (r.key in value) {
      try {
        (value as any)[r.key] = JSON.parse(r.value);
      } catch {
        /* valor corrupto: se mantiene el predeterminado */
      }
    }
  }
  cached = { at: Date.now(), value };
  return value;
}

export async function saveSettings(patch: Partial<Settings>, userId: number) {
  for (const [key, val] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    await run(
      `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
      [key, JSON.stringify(val), Date.now(), userId]
    );
  }
  cached = undefined;
}
