// Optimiza las fotografías originales de Morano (carpeta _material/fotos).
// Solo cambia formato y tamaño: no recorta, no retoca, no altera el contenido.
// Salida: public/img/<nombre>-<ancho>.{avif,webp,jpg} + src/data/images.json
//
// Uso: npm run images
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, '_material', 'fotos');
const OUT = join(root, 'public', 'img');
mkdirSync(OUT, { recursive: true });

// Nombre de salida ← archivo original. Las copias duplicadas que llegaron por
// WhatsApp ("9.54.47 AM (1)" = "9.54.47 AM", "(8)" = "(7)") se omiten.
const PHOTOS = {
  'planta-linea-proceso': 'WhatsApp Image 2026-11-03 at 9.54.46 AM (1).jpeg',
  'operario-flujo-aceite': 'WhatsApp Image 2026-11-03 at 9.54.46 AM (2).jpeg',
  'operario-muestra-aceite': 'WhatsApp Image 2026-11-03 at 9.54.46 AM.jpeg',
  'ensacado-planta': 'WhatsApp Image 2026-11-03 at 9.54.47 AM.jpeg',
  'cultivo-racimo': 'WhatsApp Image 2026-11-03 at 9.54.47 AM (2).jpeg',
  'muestra-aceite': 'WhatsApp Image 2026-11-03 at 9.54.47 AM (3).jpeg',
  'planta-maquinaria': 'WhatsApp Image 2026-11-03 at 9.54.47 AM (4).jpeg',
  'cultivo-cosecha': 'WhatsApp Image 2026-11-03 at 9.54.47 AM (5).jpeg',
  'operario-tuberias': 'WhatsApp Image 2026-11-03 at 9.54.47 AM (6).jpeg',
  'tanques-almacenamiento': 'WhatsApp Image 2026-11-03 at 9.54.47 AM (7).jpeg',
};

const manifest = {};

for (const [name, file] of Object.entries(PHOTOS)) {
  const input = join(SRC, file);
  if (!existsSync(input)) throw new Error(`Falta la foto original: ${file}`);
  const base = sharp(input).rotate(); // respeta orientación EXIF
  const meta = await base.metadata();
  const { width, height } = meta;
  // Anchos sin ampliar nunca por encima del original.
  const candidates = width > height ? [640, 960, 1280] : [420, 640, 853];
  const widths = [...new Set(candidates.map((w) => Math.min(w, width)))];
  const { dominant } = await sharp(input).stats();
  const color = `#${[dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

  for (const w of widths) {
    const pipe = sharp(input).rotate().resize({ width: w, withoutEnlargement: true });
    await pipe.clone().avif({ quality: 52, effort: 6 }).toFile(join(OUT, `${name}-${w}.avif`));
    await pipe.clone().webp({ quality: 74, effort: 6 }).toFile(join(OUT, `${name}-${w}.webp`));
    await pipe.clone().jpeg({ quality: 80, mozjpeg: true, progressive: true }).toFile(join(OUT, `${name}-${w}.jpg`));
  }
  manifest[name] = { width, height, widths, color, source: file };
  console.log(name, `${width}×${height}`, widths.join('/'), color);
}

// Imagen para redes (Open Graph 1200×630): foto real + capa azul + logotipo negativo.
const logo = readFileSync(join(root, 'src/assets/brand/logo-morano-europe-reverse.svg'), 'utf8')
  .replace('viewBox="160 28 1296 166"', 'viewBox="160 28 1296 166" width="720" height="92"');
const ogShade = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#06152E" stop-opacity=".94"/><stop offset=".7" stop-color="#06152E" stop-opacity=".86"/><stop offset="1" stop-color="#0C2750" stop-opacity=".45"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>`
);
await sharp(join(SRC, PHOTOS['planta-linea-proceso']))
  .resize(1200, 630, { fit: 'cover', position: 'centre' })
  .composite([
    { input: ogShade, top: 0, left: 0 },
    { input: Buffer.from(logo), top: 269, left: 72 },
  ])
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(join(OUT, 'og-morano-europe.jpg'));
console.log('og-morano-europe.jpg 1200×630');

mkdirSync(join(root, 'src', 'data'), { recursive: true });
writeFileSync(join(root, 'src', 'data', 'images.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('manifiesto: src/data/images.json');
