// Ajustes de la tienda leídos de src/data/ajustes.ts (importes en céntimos).
import { AJUSTES } from '../data/ajustes.ts';

export interface Settings {
  vatRateBp: number; // IVA en puntos básicos (2100 = 21 %)
  pricesIncludeVat: boolean;
  shippingCents: number | null; // null = envío sin configurar → pedido con proforma
  freeShippingFromCents: number | null;
  cardPaymentsEnabled: boolean; // requiere además las claves de Stripe
  legalName: string;
  taxId: string;
  registry: string;
  publicEmail: string;
}

export const euros = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(v * 100));

export function settingsFrom(a: typeof AJUSTES): Settings {
  return {
    vatRateBp: Math.round(a.iva * 100),
    pricesIncludeVat: a.preciosConIva,
    shippingCents: euros(a.envio),
    freeShippingFromCents: euros(a.envioGratisDesde),
    cardPaymentsEnabled: a.pagoConTarjeta,
    legalName: a.razonSocial,
    taxId: a.nif.trim(),
    registry: a.registroMercantil.trim(),
    publicEmail: a.correoPublico.trim(),
  };
}

const SETTINGS = settingsFrom(AJUSTES);

export async function getSettings(): Promise<Settings> {
  return SETTINGS;
}
