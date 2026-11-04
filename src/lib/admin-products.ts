// Alta y edición de productos desde el panel (validación del servidor).
import images from '../data/images.json';
import { FormError, lines, str } from './admin.ts';
import { get, run } from './db.ts';

export const STATIC_PHOTOS = Object.keys(images);

export interface ProductInput {
  slug: string;
  code: string;
  kind: 'direct' | 'quote';
  status: 'active' | 'inactive' | 'archived';
  sort: number;
  name_es: string;
  name_en: string;
  subtitle_es: string;
  subtitle_en: string;
  description_es: string;
  description_en: string;
  features_es: string[];
  features_en: string[];
  applications_es: string[];
  applications_en: string[];
  photo: string | null;
}

export function parseProduct(fd: FormData): ProductInput {
  const slug = str(fd, 'slug', 64).toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 2) throw new FormError('Identificador de URL no válido: use minúsculas, números y guiones (p. ej. rbd-palm-oil).');
  const code = str(fd, 'code', 16);
  if (!code) throw new FormError('El código es obligatorio (p. ej. CPO).');
  const kind = str(fd, 'kind', 10);
  if (kind !== 'direct' && kind !== 'quote') throw new FormError('Tipo de venta no válido.');
  const status = str(fd, 'status', 10);
  if (!['active', 'inactive', 'archived'].includes(status)) throw new FormError('Estado no válido.');
  const sort = Number(str(fd, 'sort', 6) || 0);
  if (!Number.isInteger(sort) || sort < 0 || sort > 99999) throw new FormError('Orden no válido.');
  const name_es = str(fd, 'name_es', 120);
  const name_en = str(fd, 'name_en', 120);
  if (!name_es || !name_en) throw new FormError('El nombre es obligatorio en español y en inglés.');
  const photo = str(fd, 'photo', 64);
  if (photo && !STATIC_PHOTOS.includes(photo)) throw new FormError('Fotografía no válida.');
  return {
    slug,
    code,
    kind,
    status: status as ProductInput['status'],
    sort,
    name_es,
    name_en,
    subtitle_es: str(fd, 'subtitle_es', 120),
    subtitle_en: str(fd, 'subtitle_en', 120),
    description_es: str(fd, 'description_es', 600),
    description_en: str(fd, 'description_en', 600),
    features_es: lines(fd, 'features_es'),
    features_en: lines(fd, 'features_en'),
    applications_es: lines(fd, 'applications_es'),
    applications_en: lines(fd, 'applications_en'),
    photo: photo || null,
  };
}

export async function saveProduct(id: number | null, p: ProductInput): Promise<number> {
  const clash = await get<{ id: number }>('SELECT id FROM products WHERE slug = ?', [p.slug]);
  if (clash && clash.id !== id) throw new FormError('Ya existe otro producto con ese identificador de URL.');
  const now = Date.now();
  const vals = [
    p.slug, p.code, p.kind, p.status, p.sort, p.name_es, p.name_en, p.subtitle_es, p.subtitle_en, p.description_es, p.description_en,
    JSON.stringify(p.features_es), JSON.stringify(p.features_en), JSON.stringify(p.applications_es), JSON.stringify(p.applications_en), p.photo,
  ];
  if (id) {
    await run(
      `UPDATE products SET slug = ?, code = ?, kind = ?, status = ?, sort = ?, name_es = ?, name_en = ?, subtitle_es = ?, subtitle_en = ?,
         description_es = ?, description_en = ?, features_es = ?, features_en = ?, applications_es = ?, applications_en = ?, photo = ?, updated_at = ?
       WHERE id = ?`,
      [...vals, now, id]
    );
    return id;
  }
  const r = await run(
    `INSERT INTO products (slug, code, kind, status, sort, name_es, name_en, subtitle_es, subtitle_en, description_es, description_en,
       features_es, features_en, applications_es, applications_en, photo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...vals, now, now]
  );
  return r.lastId!;
}
