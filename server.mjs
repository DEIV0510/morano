// Servidor de producción (Node). Envuelve el handler de Astro para añadir:
//  - compresión gzip/brotli (el adaptador Node no comprime),
//  - caché larga para imágenes, fuentes y logotipos,
//  - cabeceras de seguridad también en archivos estáticos,
//  - tiempos máximos de petición (mitiga conexiones lentas tipo slowloris),
//  - cierre ordenado con SIGTERM/SIGINT.
// Uso: npm start   (variables: HOST, PORT y las de .env.example)
import http from 'node:http';
import { existsSync } from 'node:fs';
import compression from 'compression';

if (existsSync('.env')) {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* sin .env: se usan las variables del entorno */
  }
}
process.env.ASTRO_NODE_AUTOSTART = 'disabled';
const { handler } = await import('./dist/server/entry.mjs');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 4321);
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const LONG_CACHE = /^\/(img|fonts|brand)\//;
const compress = compression({ threshold: 1024 });

const server = http.createServer((req, res) => {
  // Sin proxy de confianza delante, las cabeceras de reenvío las pone el cliente:
  // se descartan para que nadie falsee su IP (límites por IP) ni el protocolo.
  if (!TRUST_PROXY) {
    for (const h of ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port', 'x-real-ip', 'cf-connecting-ip', 'forwarded']) {
      delete req.headers[h];
    }
  }
  const path = (req.url || '/').split('?')[0];
  if (!path.startsWith('/_astro/') && LONG_CACHE.test(path)) {
    // Los nombres no llevan hash: 30 días + revalidación en segundo plano.
    const setHeader = res.setHeader.bind(res);
    res.setHeader = (name, value) =>
      setHeader(name, String(name).toLowerCase() === 'cache-control' ? 'public, max-age=2592000, stale-while-revalidate=86400' : value);
  }
  if (!res.hasHeader('x-content-type-options')) res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  compress(req, res, () => handler(req, res));
});

server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 1000;

server.listen(PORT, HOST, () => console.log(JSON.stringify({ t: new Date().toISOString(), level: 'info', where: 'server', detail: { listening: `http://${HOST}:${PORT}` } })));

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
