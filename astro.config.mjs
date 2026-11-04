// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { existsSync } from 'node:fs';

// La compilación lee también .env (SITE_URL debe coincidir con el dominio real).
if (existsSync('.env')) {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* sin .env: variables del entorno */
  }
}

const SITE = (process.env.SITE_URL || 'https://www.moranoeurope.com').replace(/\/+$/, '');

// Dominios desde los que se aceptan las cabeceras Host / X-Forwarded-* del proxy.
// Sin esta lista Astro reconstruye la URL como localhost y la comprobación de
// origen (CSRF) de los formularios fallaría detrás de un proxy HTTPS.
/** @param {string} u */
const pattern = (u) => {
  const x = new URL(u);
  return { protocol: x.protocol.replace(':', ''), hostname: x.hostname, ...(x.port ? { port: x.port } : {}) };
};
const origins = [SITE, 'https://www.moranoeurope.com', 'https://moranoeurope.com', ...(process.env.EXTRA_ALLOWED_ORIGINS || '').split(',')]
  .map((s) => s.trim())
  .filter(Boolean);
const allowedDomains = [...new Map(origins.map((o) => [o, pattern(o)])).values()];

export default defineConfig({
  site: SITE,
  output: 'server',
  adapter: node({ mode: 'standalone', bodySizeLimit: 12 * 1024 * 1024 }),
  trailingSlash: 'ignore',
  compressHTML: true,
  // Idiomas: rutas propias en /es y /en (src/lib/i18n.ts); "/" redirige según
  // el navegador (src/pages/index.ts). No se usa el enrutado i18n de Astro para
  // no interferir con /admin, /api, /media ni el sitemap.
  security: {
    // Rechaza envíos de formularios desde otros orígenes (CSRF).
    checkOrigin: true,
    allowedDomains,
  },
  build: {
    // Todo el CSS en archivos: permite una CSP estricta sin 'unsafe-inline'.
    inlineStylesheets: 'never',
  },
  prefetch: false,
  devToolbar: { enabled: false },
  vite: {
    build: {
      // Ningún script ni recurso en línea: la CSP solo admite 'self'.
      assetsInlineLimit: 0,
    },
  },
});
