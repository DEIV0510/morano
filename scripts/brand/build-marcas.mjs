// Logotipo de Morano Gruppo y sello ISCC «Certificate Holder» para la web.
// Originales en _material/marcas/ (logo del grupo enviado por el cliente con
// fondo transparente; sello ISCC tomado de moranogruppo.com). Solo se recorta el
// margen vacío y se reduce: no se retoca el contenido.
// Salida: public/img/morano-gruppo-<ancho>.webp y public/img/iscc-<ancho>.webp
//
// Uso: node scripts/brand/build-marcas.mjs
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(root, '_material', 'marcas');
const OUT = join(root, 'public', 'img');

// Recorta al contenido visible (alfa > 10): el PNG del grupo trae un velo casi
// transparente hasta los bordes que el trim normal no quita.
async function trimAlpha(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return sharp(buffer).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }).png().toBuffer();
}

async function emit(buffer, name, widths) {
  const trimmed = await trimAlpha(buffer);
  const meta = await sharp(trimmed).metadata();
  for (const w of widths) {
    await sharp(trimmed).resize({ width: w, withoutEnlargement: true }).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(join(OUT, `${name}-${w}.webp`));
  }
  console.log(name, `${meta.width}×${meta.height}`, '→', widths.join('/'));
}

await emit(await sharp(join(SRC, 'logo-morano-gruppo.png')).png().toBuffer(), 'morano-gruppo', [280, 560]);
await emit(await sharp(join(SRC, 'iscc-certificate-holder.webp')).png().toBuffer(), 'iscc', [260, 520]);
