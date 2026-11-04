// Pruebas unitarias de importes, catálogo y validación de entradas.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.APP_SECRET ||= 'unit-test-secret-unit-test-secret-unit-test-secret';

const { computeTotals, shippingFor, priceCart } = await import('../../src/lib/pricing.ts');
const { quoteSchema, contactSchema, checkoutSchema, cartSchema } = await import('../../src/lib/validation.ts');
const { settingsFrom } = await import('../../src/lib/settings.ts');
const { CATALOGO } = await import('../../src/data/catalogo.ts');
const { AJUSTES } = await import('../../src/data/ajustes.ts');

// Catálogo de prueba: precios ficticios SOLO para el test (el real no tiene precios).
const TEST_CATALOG = [
  {
    slug: 'cpko', code: 'CPKO', kind: 'direct', name: { es: 'Aceite', en: 'Oil' }, subtitle: { es: '', en: '' }, description: { es: '', en: '' },
    features: { es: [], en: [] }, applications: { es: [], en: [] },
    presentaciones: [
      { sku: 'CPKO-1KG', gramos: 1000, etiqueta: '1 kg', precio: 17.5 },
      { sku: 'CPKO-5KG', gramos: 5000, etiqueta: '5 kg', precio: null },
    ],
  },
  { slug: 'cpo', code: 'CPO', kind: 'quote', name: { es: 'CPO', en: 'CPO' }, subtitle: { es: '', en: '' }, description: { es: '', en: '' }, features: { es: [], en: [] }, applications: { es: [], en: [] } },
];
const S = settingsFrom({ ...AJUSTES, iva: 21, preciosConIva: true, envio: 9.9, envioGratisDesde: 100 });

test('catálogo real: 11 productos, CPKO y PKE con 5 presentaciones y sin precios inventados', () => {
  assert.equal(CATALOGO.length, 11);
  const direct = CATALOGO.filter((p) => p.kind === 'direct');
  assert.deepEqual(direct.map((p) => p.code), ['CPKO', 'PKE']);
  for (const p of direct) {
    assert.deepEqual(p.presentaciones.map((v) => v.etiqueta), ['500 g', '1 kg', '2 kg', '5 kg', '20 kg']);
  }
  const skus = CATALOGO.flatMap((p) => p.presentaciones ?? []).map((v) => v.sku);
  assert.equal(new Set(skus).size, skus.length, 'SKU únicos');
  assert.ok(skus.every((s) => /^[A-Z0-9-]{2,40}$/.test(s)));
  assert.ok(new Set(CATALOGO.map((p) => p.slug)).size === CATALOGO.length, 'slugs únicos');
});

test('precio del carrito: lo fija el catálogo del servidor y descarta lo que no se puede comprar', () => {
  const r = priceCart({ items: [{ sku: 'CPKO-1KG', qty: 2 }, { sku: 'CPKO-1KG', qty: 1 }, { sku: 'CPKO-5KG', qty: 1 }, { sku: 'NO-EXISTE', qty: 1 }] }, S, 'es', TEST_CATALOG);
  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].qty, 3, 'líneas repetidas se agrupan');
  assert.equal(r.subtotalCents, 5250);
  assert.equal(r.shippingCents, 990);
  assert.equal(r.totalCents, 6240);
  assert.deepEqual(r.issues.map((i) => i.reason).sort(), ['no_price', 'unavailable']);
});

test('envío gratis desde el umbral; un producto de cotización no se puede comprar', () => {
  const r = priceCart({ items: [{ sku: 'CPKO-1KG', qty: 6 }] }, S, 'es', TEST_CATALOG);
  assert.equal(r.shippingCents, 0);
  assert.equal(r.totalCents, 10500);
  const q = priceCart({ items: [{ sku: 'CPO', qty: 1 }] }, S, 'es', TEST_CATALOG);
  assert.equal(q.lines.length, 0);
});

test('IVA incluido: el total no cambia y se desglosa la cuota', () => {
  assert.deepEqual(computeTotals(31500, null, 2100, true), { vatCents: 5467, totalCents: 31500 });
  assert.deepEqual(computeTotals(10000, 500, 2100, true), { vatCents: 1822, totalCents: 10500 });
});

test('IVA no incluido: se suma al total', () => {
  assert.deepEqual(computeTotals(10000, 0, 2100, false), { vatCents: 2100, totalCents: 12100 });
});

test('envío: sin configurar, fijo y gratis desde un importe', () => {
  assert.equal(shippingFor(5000, { shippingCents: null, freeShippingFromCents: null }), null);
  assert.equal(shippingFor(5000, { shippingCents: 900, freeShippingFromCents: null }), 900);
  assert.equal(shippingFor(15000, { shippingCents: 900, freeShippingFromCents: 10000 }), 0);
});

const goodQuote = {
  fullName: 'Ana Pérez',
  company: 'Distribuciones Norte SL',
  email: ' Ana@Example.COM ',
  country: 'es',
  phone: '+34 600 000 000',
  product: 'cpo',
  volume: '25 t / mes',
  needs: 'Línea 1\r\nLínea 2',
  consent: true,
  locale: 'es',
};

test('cotización válida: normaliza correo, país y saltos de línea', () => {
  const r = quoteSchema.parse(goodQuote);
  assert.equal(r.email, 'ana@example.com');
  assert.equal(r.country, 'ES');
  assert.equal(r.needs, 'Línea 1\nLínea 2');
});

test('cotización: rechaza correo, país, consentimiento y producto inválidos', () => {
  assert.equal(quoteSchema.safeParse({ ...goodQuote, email: 'no-es-correo' }).success, false);
  assert.equal(quoteSchema.safeParse({ ...goodQuote, country: 'XX' }).success, false);
  assert.equal(quoteSchema.safeParse({ ...goodQuote, consent: false }).success, false);
  assert.equal(quoteSchema.safeParse({ ...goodQuote, product: "cpo' OR 1=1--" }).success, false);
  assert.equal(quoteSchema.safeParse({ ...goodQuote, fullName: 'x'.repeat(500) }).success, false);
});

test('texto de una línea: elimina caracteres de control (inyección de cabeceras)', () => {
  const r = quoteSchema.parse({ ...goodQuote, company: 'ACME\r\nBcc: victima@x.com' });
  assert.equal(r.company.includes('\n'), false);
});

test('contacto: teléfono y país opcionales', () => {
  const r = contactSchema.parse({ fullName: 'Ana', email: 'a@b.co', message: 'Mensaje suficientemente largo', consent: true });
  assert.equal(r.phone, '');
  assert.equal(r.country, '');
});

test('carrito: solo SKU y cantidades enteras en rango; precios del cliente ignorados', () => {
  assert.equal(cartSchema.safeParse({ items: [{ sku: 'CPKO-1KG', qty: 0 }] }).success, false);
  assert.equal(cartSchema.safeParse({ items: [{ sku: 'CPKO-1KG', qty: 1000 }] }).success, false);
  assert.equal(cartSchema.safeParse({ items: [{ sku: "x' OR 1=1", qty: 1 }] }).success, false);
  assert.equal(cartSchema.safeParse({ items: Array.from({ length: 21 }, (_, i) => ({ sku: `A-${i}`, qty: 1 })) }).success, false);
  const r = cartSchema.parse({ items: [{ sku: 'PKE-2KG', qty: 2, price: 1, unitCents: 1 }] });
  assert.deepEqual(r.items, [{ sku: 'PKE-2KG', qty: 2 }]);
});

test('checkout: exige aceptar condiciones y clave de idempotencia', () => {
  const base = {
    items: [{ sku: 'CPKO-1KG', qty: 1 }],
    customer: { fullName: 'Ana', email: 'a@b.co', phone: '600000000', address1: 'Calle 1', city: 'Madrid', postalCode: '28001', country: 'ES' },
    acceptTerms: true,
    idempotencyKey: 'abcdefghijklmnop',
    locale: 'es',
  };
  assert.equal(checkoutSchema.safeParse(base).success, true);
  assert.equal(checkoutSchema.safeParse({ ...base, acceptTerms: false }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...base, idempotencyKey: 'corta' }).success, false);
  assert.equal(checkoutSchema.safeParse({ ...base, totalCents: 1 }).success, true, 'campos extra se descartan');
});
