// Pruebas de seguridad contra el servidor en marcha (compilación de producción).
//   npm run build && npm start      (en otra terminal)
//   TEST_BASE_URL=http://localhost:4321 npm run test:api
// Crea registros de prueba en la base de datos configurada y los elimina al
// terminar. No usar contra producción.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

try {
  process.loadEnvFile('.env');
} catch {
  /* sin .env (CI): se usan las variables del entorno */
}
const BASE = (process.env.TEST_BASE_URL || process.env.SITE_URL || 'http://localhost:5631').replace(/\/$/, '');
if (/moranoeurope\.com/.test(BASE)) throw new Error('Estas pruebas no deben ejecutarse contra producción.');

const { run, get } = await import('../../src/lib/db.ts');
const { CATALOGO } = await import('../../src/data/catalogo.ts');

async function clean() {
  await run("DELETE FROM quotes WHERE email LIKE '%@qa.test.local'");
  await run("DELETE FROM messages WHERE email LIKE '%@qa.test.local'");
  await run("DELETE FROM rate_limits WHERE key LIKE 'quote:%' OR key LIKE 'contact:%' OR key LIKE 'cartQuote:%' OR key LIKE 'checkout:%'");
}
before(clean);
after(clean);

const json = (path, body, headers = {}) =>
  fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('cabeceras de seguridad en páginas y API', async () => {
  const res = await fetch(`${BASE}/es/`);
  assert.equal(res.status, 200);
  const csp = res.headers.get('content-security-policy') || '';
  assert.match(csp, /script-src 'self'(;|$)/, 'sin unsafe-inline en scripts');
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('referrer-policy'));
  assert.ok(res.headers.get('permissions-policy'));
  const html = await res.text();
  assert.equal(/<script(?![^>]*\s(src=|type="application\/(ld\+)?json"))[^>]*>/i.test(html), false, 'no hay scripts en línea ejecutables');
  const api = await json('/api/cart', { items: [] });
  assert.equal(api.headers.get('cache-control'), 'no-store');
  assert.equal(api.headers.get('access-control-allow-origin'), null, 'sin CORS abierto');
});

test('no existe ningún panel ni ruta de administración', async () => {
  for (const p of ['/admin', '/admin/login', '/admin/pedidos', '/wp-admin', '/api/admin']) {
    const r = await fetch(BASE + p, { redirect: 'manual' });
    assert.equal(r.status, 404, p);
  }
});

test('peticiones desde otro origen (CSRF) rechazadas', async () => {
  assert.equal((await json('/api/cart', { items: [] }, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await json('/api/quote', {}, { 'sec-fetch-site': 'cross-site' })).status, 403);
  const form = await fetch(`${BASE}/api/contact`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://evil.example' },
    body: 'fullName=a&email=a%40b.co&message=xxxxxxxxxxxx&consent=1',
    redirect: 'manual',
  });
  assert.equal(form.status, 403, 'formulario de otro origen bloqueado');
});

test('API del carrito: valida tipos y tamaños; nunca acepta precios del cliente', async () => {
  assert.equal((await json('/api/cart', { items: [{ sku: 'CPKO-1KG', qty: -3 }] })).status, 422);
  assert.equal((await json('/api/cart', { items: [{ sku: "x' OR 1=1--", qty: 1 }] })).status, 422);
  assert.equal((await json('/api/cart', 'no-json')).status, 400);
  assert.equal((await fetch(`${BASE}/api/cart`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' })).status, 415);
  assert.equal((await json('/api/cart', { items: [], pad: 'x'.repeat(40_000) })).status, 413);
  const r = await json('/api/cart', { items: [{ sku: 'CPKO-1KG', qty: 1, price: 0.01, unitCents: 1 }], locale: 'es' });
  const data = await r.json();
  assert.equal(r.status, 200);
  const priced = CATALOGO.find((p) => p.slug === 'cpko').presentaciones.find((v) => v.sku === 'CPKO-1KG').precio;
  if (priced === null) {
    assert.equal(data.lines.length, 0, 'sin precio publicado no se puede comprar');
    assert.equal(data.issues[0].reason, 'no_price');
  } else {
    assert.notEqual(data.totals.total, '0,01 €', 'el precio lo fija el servidor');
  }
});

test('checkout: rechaza pedidos de presentaciones sin precio o inexistentes', async () => {
  const body = {
    items: [{ sku: 'NO-EXISTE', qty: 1 }],
    customer: { fullName: 'QA', email: 'qa@qa.test.local', phone: '600000000', address1: 'Calle 1', city: 'Madrid', postalCode: '28001', country: 'ES' },
    acceptTerms: true,
    idempotencyKey: `qa-${Date.now()}-abcdefgh`,
    locale: 'es',
  };
  assert.equal((await json('/api/checkout', body)).status, 409);
});

test('formularios públicos: antispam y validación', async () => {
  const base = { fullName: 'QA', company: 'QA SL', email: 'x@qa.test.local', country: 'ES', phone: '600000000', product: 'cpo', volume: '1 t', consent: true, locale: 'es' };
  assert.equal((await json('/api/quote', { ...base, email: 'malo' })).status, 422);
  assert.equal((await json('/api/quote', base)).status, 400, 'sin token de formulario');
  assert.equal((await json('/api/quote', { ...base, website: 'http://spam', ft: '1.x' })).status, 400, 'campo trampa');
});

test('cotización real: contenido malicioso guardado como texto y límite por IP (X-Forwarded-For no lo evita)', async () => {
  const html = await (await fetch(`${BASE}/es/`)).text();
  const ft = html.match(/name="ft" value="([^"]+)"/)[1];
  await new Promise((r) => setTimeout(r, 2700));
  const payload = { fullName: '<img src=x onerror=alert(1)>', company: 'QA SL', email: 'xss@qa.test.local', country: 'ES', phone: '600000000', product: 'cpo', volume: '1 t', consent: true, locale: 'es', ft, website: '' };
  const ok = await json('/api/quote', payload);
  assert.equal(ok.status, 200);
  const { ref } = await ok.json();
  assert.match(ref, /^MQ-\d{2}-[A-Z0-9]{7}$/);
  const row = await get('SELECT full_name, product_label FROM quotes WHERE ref = ?', [ref]);
  assert.equal(row.full_name, '<img src=x onerror=alert(1)>', 'se guarda tal cual; los correos lo escapan');
  assert.match(row.product_label, /^CPO — /);
  assert.equal((await json('/api/quote', { ...payload, product: 'producto-inventado' })).status, 422, 'producto fuera del catálogo');

  let last = 0;
  for (let i = 0; i < 6; i++) {
    last = (await json('/api/quote', { ...payload, email: `rl${i}@qa.test.local` }, { 'x-forwarded-for': `203.0.113.${i}` })).status;
  }
  assert.equal(last, 429);
});

test('rutas con entradas maliciosas devuelven 404, no errores', async () => {
  for (const p of ["/es/productos/'%20OR%201=1--", '/es/productos/..%2F..%2Fetc%2Fpasswd', '/es/pedido/ME-26-AAAAAAA?t=%27%22%3E%3Cscript%3E', '/es/pedido/ME-26-AAAAAAA']) {
    const r = await fetch(BASE + p);
    assert.ok([404, 400].includes(r.status), `${p} → ${r.status}`);
  }
  assert.equal((await fetch(`${BASE}/.env`)).status, 404);
  assert.equal((await fetch(`${BASE}/data/morano.db`)).status, 404);
  assert.equal((await fetch(`${BASE}/src/data/catalogo.ts`)).status, 404);
});

test('SEO técnico: robots, sitemap con hreflang y redirección por idioma', async () => {
  const robots = await (await fetch(`${BASE}/robots.txt`)).text();
  assert.match(robots, /Disallow: \/api\//);
  assert.match(robots, /Sitemap: /);
  const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
  assert.match(sm, /hreflang="es-ES"/);
  assert.match(sm, /\/en\/products\/cpko/);
  const es = await fetch(`${BASE}/`, { headers: { 'accept-language': 'es-ES,es;q=0.9' }, redirect: 'manual' });
  assert.equal(es.headers.get('location'), '/es/');
  const en = await fetch(`${BASE}/`, { headers: { 'accept-language': 'de-DE,en;q=0.5' }, redirect: 'manual' });
  assert.equal(en.headers.get('location'), '/en/');
  const page = await (await fetch(`${BASE}/en/products/pke`)).text();
  assert.match(page, /<link rel="canonical" href="[^"]+\/en\/products\/pke"/);
  assert.match(page, /hreflang="es-ES" href="[^"]+\/es\/productos\/pke"/);
  assert.match(page, /"@type":"Product"/);
});
