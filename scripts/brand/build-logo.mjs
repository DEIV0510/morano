// Genera las versiones SVG del logotipo oficial de Morano Europe SL.
//
// Fuente: logo oficial (raster 1598×213) publicado en moranogruppo.com.
// - Los cuatro marcos se reconstruyen con la geometría medida en píxeles
//   (trazo de 7 px) y respetan el entrelazado original: el gris claro pasa
//   por encima del azul y del gris medio en un cruce y por debajo en el otro.
// - Las letras (Century Gothic en el original) se vectorizaron con potrace
//   desde el mismo raster: ver trace_logo.py y logo-wordmark-paths.json.
//
// Uso: node scripts/brand/build-logo.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const words = JSON.parse(readFileSync(join(here, 'logo-wordmark-paths.json'), 'utf8'));

export const BRAND = {
  navy: '#0C2750',
  gold: '#CA9E31',
  gray: '#7A7A7D',
  silver: '#CBCDD0',
};

const STROKE = 7;

// Rectángulos en coordenadas del raster original (línea central del trazo).
const frames = {
  gold: { x: 273.5, y: 35.5, w: 101, h: 78 },
  gray: { x: 235.5, y: 97.5, w: 121, h: 89 },
  navy: { x: 203.5, y: 75.5, w: 108, h: 52 },
  silver: { x: 167.5, y: 118.5, w: 98, h: 54 },
};

function rect(f, color) {
  return `<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="none" stroke="${color}" stroke-width="${STROKE}"/>`;
}

function mark(c) {
  return [
    rect(frames.gold, c.gold),
    rect(frames.gray, c.gray),
    rect(frames.navy, c.navy),
    rect(frames.silver, c.silver),
    // Cruces donde el gris claro queda por debajo (entrelazado del original)
    `<rect x="260" y="124" width="10" height="7" fill="${c.navy}"/>`,
    `<rect x="232" y="167" width="7" height="10" fill="${c.gray}"/>`,
  ].join('');
}

function wordmark(c) {
  return [
    `<path fill="${c.navy}" fill-rule="evenodd" d="${words.morano}"/>`,
    `<path fill="${c.gold}" fill-rule="evenodd" d="${words.europe}"/>`,
    `<path fill="${c.gray}" fill-rule="evenodd" d="${words.sl}"/>`,
  ].join('');
}

const full = (c, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="160 28 1296 166" role="img" aria-label="${title}"><title>${title}</title>${mark(c)}${wordmark(c)}</svg>\n`;

const icon = (c, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="152 20 236 178">${bg ? `<rect x="152" y="20" width="236" height="178" fill="${bg}"/>` : ''}${mark(c)}</svg>\n`;

// Versión negativa para fondos oscuros: el azul pasa a blanco; el resto se mantiene.
const reverse = { ...BRAND, navy: '#FFFFFF' };

const out = {
  'src/assets/brand/logo-morano-europe.svg': full(BRAND, 'Morano Europe SL'),
  'src/assets/brand/logo-morano-europe-reverse.svg': full(reverse, 'Morano Europe SL'),
  'src/assets/brand/mark.svg': icon(BRAND),
  'public/favicon.svg': icon(BRAND),
  'public/brand/logo-morano-europe.svg': full(BRAND, 'Morano Europe SL'),
  'public/brand/logo-morano-europe-reverse.svg': full(reverse, 'Morano Europe SL'),
};

for (const [rel, svg] of Object.entries(out)) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, svg);
  console.log('escrito', rel, svg.length, 'bytes');
}

// Iconos PNG (favicon clásico, iOS y manifiesto): marco del logo sobre blanco.
const sharp = (await import('sharp')).default;
const pad = (size) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="132 2 276 276"><rect x="132" y="2" width="276" height="276" fill="#FFFFFF"/>${mark(BRAND)}</svg>`
  );
for (const [file, size] of [['public/favicon-32.png', 32], ['public/apple-touch-icon.png', 180], ['public/icon-192.png', 192], ['public/icon-512.png', 512]]) {
  await sharp(pad(size)).png().toFile(join(root, file));
  console.log('escrito', file);
}

// Exporta también los trazos para componentes (loader animado, cabecera).
writeFileSync(
  join(root, 'src/assets/brand/logo-data.json'),
  JSON.stringify({ frames, stroke: STROKE, words, colors: BRAND }, null, 0)
);
console.log('escrito src/assets/brand/logo-data.json');
