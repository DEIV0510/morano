// Subida de imágenes desde el panel.
// Validación por contenido real (no por extensión ni por el tipo que declara
// el navegador), límite de tamaño y de píxeles, sin SVG (podría contener
// scripts) y re-codificación completa a WebP: se descartan EXIF/GPS y
// cualquier dato incrustado en el archivo original.
import sharp from 'sharp';
import { batch, get } from './db.ts';
import { ApiError } from './http.ts';
import { randomToken } from './security/crypto.ts';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(['jpeg', 'png', 'webp', 'avif']);
export const MEDIA_WIDTHS = [480, 960, 1600] as const;

export async function storeImage(file: File, userId: number): Promise<string> {
  if (!(file instanceof File) || file.size === 0) throw new ApiError(400, 'no_file', 'No se recibió ningún archivo.');
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, 'too_large', 'La imagen supera 8 MB.');
  const buf = Buffer.from(await file.arrayBuffer());
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    meta = await sharp(buf, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new ApiError(415, 'not_image', 'El archivo no es una imagen válida.');
  }
  if (!meta.format || !ALLOWED.has(meta.format)) throw new ApiError(415, 'format', 'Formato no admitido. Use JPG, PNG, WebP o AVIF.');
  if (!meta.width || !meta.height || meta.width < 200 || meta.height < 200) throw new ApiError(422, 'too_small', 'La imagen es demasiado pequeña (mínimo 200 px).');

  const base = sharp(buf, { limitInputPixels: 40_000_000 }).rotate();
  const { dominant } = await base.clone().stats();
  const color = `#${[dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const id = randomToken(12).replace(/[^A-Za-z0-9]/g, 'x');
  const variants: { width: number; data: Buffer }[] = [];
  let finalW = 0;
  let finalH = 0;
  for (const w of MEDIA_WIDTHS) {
    const out = await base.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toBuffer({ resolveWithObject: true });
    variants.push({ width: w, data: out.data });
    if (out.info.width > finalW) {
      finalW = out.info.width;
      finalH = out.info.height;
    }
  }
  const bytes = variants.reduce((s, v) => s + v.data.length, 0);
  await batch([
    { sql: 'INSERT INTO media (id, width, height, bytes, color, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [id, finalW, finalH, bytes, color, Date.now(), userId] },
    ...variants.map((v) => ({ sql: 'INSERT INTO media_variants (media_id, width, data) VALUES (?, ?, ?)', args: [id, v.width, v.data] })),
  ]);
  return id;
}

export async function readMedia(id: string, width: number) {
  if (!/^[A-Za-z0-9]{16}$/.test(id)) return undefined;
  const w = MEDIA_WIDTHS.includes(width as any) ? width : 960;
  return get<{ data: Uint8Array }>('SELECT data FROM media_variants WHERE media_id = ? AND width = ?', [id, w]);
}

export const mediaUrl = (id: string, width: number) => `/media/${id}-${width}.webp`;
