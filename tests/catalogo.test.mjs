// Comprueba el catálogo antes de publicar (npm test): SKU y URLs únicos,
// presentaciones completas y precios válidos (número positivo o null).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO } from '../src/data/catalogo.ts';
import { AJUSTES } from '../src/data/ajustes.ts';
import { computeTotals } from '../src/lib/pricing.ts';

test('catálogo: 11 productos con slugs y SKU únicos', () => {
  assert.equal(CATALOGO.length, 11);
  assert.equal(new Set(CATALOGO.map((p) => p.slug)).size, CATALOGO.length);
  const skus = CATALOGO.flatMap((p) => p.presentaciones ?? []).map((v) => v.sku);
  assert.equal(new Set(skus).size, skus.length);
  assert.ok(skus.every((s) => /^[A-Z0-9-]{2,40}$/.test(s)));
});

test('CPKO y PKE: cinco presentaciones y precios válidos', () => {
  for (const code of ['CPKO', 'PKE']) {
    const p = CATALOGO.find((x) => x.code === code);
    assert.equal(p.kind, 'direct');
    assert.deepEqual(p.presentaciones.map((v) => v.etiqueta), ['500 g', '1 kg', '2 kg', '5 kg', '20 kg']);
    for (const v of p.presentaciones) assert.ok(v.precio === null || (typeof v.precio === 'number' && v.precio > 0), `${v.sku}: precio no válido`);
  }
});

test('ajustes: IVA y envío con valores válidos', () => {
  assert.ok(AJUSTES.iva >= 0 && AJUSTES.iva < 100);
  assert.ok(AJUSTES.envio === null || AJUSTES.envio >= 0);
});

test('IVA incluido y no incluido', () => {
  assert.deepEqual(computeTotals(31500, null, 2100, true), { vatCents: 5467, totalCents: 31500 });
  assert.deepEqual(computeTotals(10000, 0, 2100, false), { vatCents: 2100, totalCents: 12100 });
});
