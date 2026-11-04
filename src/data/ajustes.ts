// ─────────────────────────────────────────────────────────────
// AJUSTES DE LA TIENDA Y DATOS LEGALES — se editan aquí.
// Tras editar, subir a GitHub: Vercel publica los cambios solo.
// ─────────────────────────────────────────────────────────────
export const AJUSTES = {
  /** IVA en %. */
  iva: 21,
  /** true = los precios de catalogo.ts ya incluyen el IVA. */
  preciosConIva: true,
  /** Coste de envío por pedido en euros. null = se confirma por WhatsApp; 0 = gratis. */
  envio: null as number | null,
  /** Envío gratis desde este subtotal en euros (opcional). */
  envioGratisDesde: null as number | null,

  // Datos de la sociedad (aviso legal, privacidad, condiciones). Solo se publican si están rellenos.
  razonSocial: 'MORANO EUROPE SL',
  nif: '',
  registroMercantil: '',
  correoPublico: '',
};
