// @ts-check
import { defineConfig } from 'astro/config';

// Web estática: Vercel (o cualquier hosting) la publica sin servidor ni base de datos.
export default defineConfig({
  site: 'https://www.moranoeurope.com',
  output: 'static',
  trailingSlash: 'ignore',
  compressHTML: true,
  build: {
    // Todo el CSS en archivos: permite una CSP estricta sin 'unsafe-inline' (vercel.json).
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
