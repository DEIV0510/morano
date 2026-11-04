// Carga el catálogo inicial si la base de datos está vacía.
import { get, run } from './db.ts';
import { DIRECT_SIZES, SEED_PRODUCTS } from './seed-data.ts';

export async function seedCatalog(): Promise<number> {
  const has = await get<{ n: number }>('SELECT COUNT(*) AS n FROM products');
  if (has && has.n > 0) return 0;
  const now = Date.now();
  let sort = 0;
  for (const p of SEED_PRODUCTS) {
    sort += 10;
    const r = await run(
      `INSERT INTO products (slug, code, kind, status, sort, name_es, name_en, subtitle_es, subtitle_en, description_es, description_en,
         features_es, features_en, applications_es, applications_en, photo, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.slug, p.code, p.kind, sort, p.name[0], p.name[1], p.subtitle[0], p.subtitle[1], p.description[0], p.description[1],
        JSON.stringify(p.features[0]), JSON.stringify(p.features[1]), JSON.stringify(p.applications[0]), JSON.stringify(p.applications[1]),
        p.photo ?? null, now, now,
      ]
    );
    if (p.kind === 'direct' && r.lastId) {
      let vs = 0;
      for (const s of DIRECT_SIZES) {
        vs += 10;
        const sku = `${p.code}-${s.label.replace(/\s+/g, '').toUpperCase()}`;
        // Precio y existencias vacíos: no se inventan. Se fijan desde el panel.
        await run(
          `INSERT INTO variants (product_id, sku, label_es, label_en, grams, price_cents, stock, low_stock_threshold, status, sort, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, 'active', ?, ?)`,
          [r.lastId, sku, s.label, s.label, s.grams, vs, now]
        );
      }
    }
  }
  return SEED_PRODUCTS.length;
}
