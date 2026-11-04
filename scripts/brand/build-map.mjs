// Genera el mapa de puntos de la sección "Colombia — Europa".
// Datos: Natural Earth 1:50m (world-atlas, dominio público). Se ejecuta una
// vez y el SVG resultante se versiona; el sitio no carga datos geográficos.
//
// Uso (con world-atlas, topojson-client y d3-geo instalados en otra carpeta):
//   node scripts/brand/build-map.mjs <ruta a node_modules>
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const mods = process.argv[2];
if (!mods) throw new Error('Indique la carpeta node_modules con world-atlas, topojson-client y d3-geo');
const require = createRequire(join(mods, 'x.js'));
const { feature } = require('topojson-client');
const { geoContains } = require('d3-geo');
const land = feature(require('world-atlas/land-50m.json'), require('world-atlas/land-50m.json').objects.land);

// Encuadre: Américas, Atlántico, Europa y África occidental.
const LON0 = -125, LON1 = 62, LAT0 = -48, LAT1 = 70;
const W = 1200;
const H = Math.round((W * (LAT1 - LAT0)) / (LON1 - LON0));
const STEP = 1.55; // grados entre puntos

const x = (lon) => ((lon - LON0) / (LON1 - LON0)) * W;
const y = (lat) => ((LAT1 - lat) / (LAT1 - LAT0)) * H;

let d = '';
let n = 0;
for (let lat = LAT1 - STEP / 2; lat > LAT0; lat -= STEP) {
  for (let lon = LON0 + STEP / 2; lon < LON1; lon += STEP) {
    if (geoContains(land, [lon, lat])) {
      d += `M${x(lon).toFixed(1)} ${y(lat).toFixed(1)}h0`;
      n++;
    }
  }
}

// Puntos documentados: Colombia (Santa Marta, sede del grupo) y Madrid (Paseo de la Castellana 200).
const points = {
  colombia: { lon: -74.2, lat: 11.24, x: +x(-74.2).toFixed(1), y: +y(11.24).toFixed(1) },
  madrid: { lon: -3.69, lat: 40.46, x: +x(-3.69).toFixed(1), y: +y(40.46).toFixed(1) },
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
mkdirSync(join(root, 'src', 'data'), { recursive: true });
writeFileSync(join(root, 'src', 'data', 'map.json'), JSON.stringify({ width: W, height: H, step: STEP, points }) + '\n');
// Puntos como archivo aparte: se cachea y no aumenta el peso del HTML.
mkdirSync(join(root, 'public', 'img'), { recursive: true });
writeFileSync(
  join(root, 'public', 'img', 'mapa-puntos.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><path d="${d}" fill="none" stroke="#CBCDD0" stroke-opacity=".34" stroke-width="3.4" stroke-linecap="round"/></svg>\n`
);
console.log(`Mapa: ${W}×${H}, ${n} puntos, ${(d.length / 1024).toFixed(1)} KB de trazado`, points);
