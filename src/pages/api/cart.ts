// POST /api/cart — devuelve el carrito con precios, existencias e importes
// calculados en el servidor. El navegador solo envía presentación y cantidad.
import type { APIRoute } from 'astro';
import { handler, json, readJson } from '../../lib/http.ts';
import { guard } from '../../lib/public-api.ts';
import { paymentMode } from '../../lib/orders.ts';
import { formatMoney, priceCart } from '../../lib/pricing.ts';
import { getSettings } from '../../lib/settings.ts';
import { cartSchema, parse } from '../../lib/validation.ts';
import { isLocale } from '../../lib/i18n.ts';

export const POST: APIRoute = handler('api.cart', async (ctx) => {
  await guard(ctx, 'cartQuote');
  const raw = (await readJson(ctx.request)) as Record<string, unknown>;
  const locale = isLocale(raw?.locale) ? raw.locale : 'es';
  const input = parse(cartSchema, { items: raw?.items ?? [] });
  const settings = await getSettings();
  const cart = await priceCart(input, settings, locale);
  const m = (c: number) => formatMoney(c, locale);
  return json({
    ok: true,
    lines: cart.lines.map((l) => ({
      variantId: l.variantId,
      productSlug: l.productSlug,
      productCode: l.productCode,
      productName: l.productName,
      variantLabel: l.variantLabel,
      qty: l.qty,
      maxQty: l.maxQty,
      unit: m(l.unitCents),
      total: m(l.lineCents),
    })),
    issues: cart.issues,
    totals: {
      subtotal: m(cart.subtotalCents),
      shipping: cart.shippingCents === null ? null : m(cart.shippingCents),
      shippingFree: cart.shippingCents === 0,
      vat: m(cart.vatCents),
      vatIncluded: cart.vatIncluded,
      vatRate: `${(cart.vatRateBp / 100).toLocaleString(locale)} %`,
      total: m(cart.totalCents),
    },
    paymentMode: paymentMode(cart, settings),
  });
});
