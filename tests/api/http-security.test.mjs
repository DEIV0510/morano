// Pruebas de seguridad contra el servidor en marcha (compilación de producción).
//   npm run build && npm start      (en otra terminal)
//   TEST_BASE_URL=http://localhost:5631 npm run test:api
// Crea usuarios y registros de prueba en la base de datos configurada y los
// elimina al terminar. No usar contra producción.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

try {
  process.loadEnvFile('.env');
} catch {
  /* sin .env (CI): se usan las variables del entorno */
}
const BASE = (process.env.TEST_BASE_URL || process.env.SITE_URL || 'http://localhost:5631').replace(/\/$/, '');
if (/moranoeurope\.com/.test(BASE)) throw new Error('Estas pruebas no deben ejecutarse contra producción.');

const { run, all, get } = await import('../../src/lib/db.ts');
const { hashPassword } = await import('../../src/lib/security/crypto.ts');

const PW = 'Prueba-Segura-QA-2026!';
const USERS = { viewer: 'qa.viewer@test.local', sales: 'qa.sales@test.local', admin: 'qa.admin@test.local', lock: 'qa.lock@test.local' };

class Client {
  jar = new Map();
  async req(path, init = {}) {
    const headers = new Headers(init.headers || {});
    if (this.jar.size) headers.set('cookie', [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '));
    const res = await fetch(BASE + path, { ...init, headers, redirect: 'manual' });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';');
      const [k, v] = pair.split('=');
      if (/Max-Age=0|expires=Thu, 01 Jan 1970/i.test(c)) this.jar.delete(k);
      else this.jar.set(k, v);
    }
    return res;
  }
  form(path, data, extra = {}) {
    return this.req(path, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: BASE, ...extra },
      body: new URLSearchParams(data).toString(),
    });
  }
  async login(email, password = PW) {
    return this.form('/admin/login', { email, password });
  }
  async csrf(path = '/admin') {
    const html = await (await this.req(path)).text();
    return html.match(/name="_csrf" value="([^"]+)"/)?.[1];
  }
}

async function clean() {
  await run("DELETE FROM users WHERE email LIKE 'qa.%@test.local'");
  await run("DELETE FROM quotes WHERE email LIKE '%@qa.test.local'");
  await run("DELETE FROM messages WHERE email LIKE '%@qa.test.local'");
  await run("DELETE FROM rate_limits WHERE key LIKE 'quote:%' OR key LIKE 'contact:%' OR key LIKE 'login:%' OR key LIKE 'mfa:%' OR key LIKE 'cartQuote:%' OR key LIKE 'admin:%'");
}

before(async () => {
  await clean();
  const now = Date.now();
  const hash = await hashPassword(PW);
  for (const [role, email] of Object.entries(USERS)) {
    await run('INSERT INTO users (email, name, role, password_hash, active, password_changed_at, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)', [
      email, `QA ${role}`, role === 'lock' ? 'viewer' : role, hash, now, now,
    ]);
  }
});
after(clean);

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
  const api = await fetch(`${BASE}/api/cart`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"items":[]}' });
  assert.equal(api.headers.get('cache-control'), 'no-store');
  assert.equal(api.headers.get('access-control-allow-origin'), null, 'sin CORS abierto');
});

test('todas las rutas del panel exigen sesión', async () => {
  for (const p of ['/admin', '/admin/pedidos', '/admin/pedidos/1', '/admin/cotizaciones', '/admin/mensajes', '/admin/productos', '/admin/productos/1', '/admin/inventario', '/admin/contenido', '/admin/ajustes', '/admin/usuarios', '/admin/auditoria', '/admin/cuenta']) {
    const res = await fetch(BASE + p, { redirect: 'manual' });
    assert.equal(res.status, 303, p);
    assert.match(res.headers.get('location') || '', /\/admin\/login/, p);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  }
});

test('peticiones desde otro origen (CSRF) rechazadas', async () => {
  const api = await fetch(`${BASE}/api/cart`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{"items":[]}' });
  assert.equal(api.status, 403);
  const site = await fetch(`${BASE}/api/quote`, { method: 'POST', headers: { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }, body: '{}' });
  assert.equal(site.status, 403);
  const form = await fetch(`${BASE}/admin/login`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://evil.example' }, body: 'email=a&password=b', redirect: 'manual' });
  assert.equal(form.status, 403, 'formulario de otro origen bloqueado');
});

test('API del carrito: valida tipos, tamaños y no acepta precios del cliente', async () => {
  const post = (body, type = 'application/json') => fetch(`${BASE}/api/cart`, { method: 'POST', headers: { 'content-type': type }, body });
  assert.equal((await post('{"items":[{"variantId":1,"qty":-3}]}')).status, 422);
  assert.equal((await post('{"items":[{"variantId":"1 OR 1=1","qty":1}]}')).status, 422);
  assert.equal((await post('no-json')).status, 400);
  assert.equal((await post('{"items":[]}', 'text/plain')).status, 415);
  assert.equal((await post(JSON.stringify({ items: [], pad: 'x'.repeat(40_000) }))).status, 413);
  const v = await get("SELECT v.id, v.price_cents FROM variants v JOIN products p ON p.id = v.product_id WHERE p.kind = 'direct' AND v.price_cents IS NOT NULL LIMIT 1");
  if (v) {
    const r = await post(JSON.stringify({ items: [{ variantId: v.id, qty: 1, price: 1, unitCents: 1 }], locale: 'es' }));
    const data = await r.json();
    assert.equal(r.status, 200);
    assert.equal(data.lines.length, 1);
    assert.notEqual(data.totals.total, '0,01 €', 'el precio lo fija el servidor');
  }
});

test('checkout: rechaza pedidos sin productos válidos o de presentaciones sin precio', async () => {
  const noPrice = await get("SELECT v.id FROM variants v WHERE v.price_cents IS NULL LIMIT 1");
  const body = {
    items: [{ variantId: noPrice?.id ?? 999999, qty: 1 }],
    customer: { fullName: 'QA', email: 'qa@qa.test.local', phone: '600000000', address1: 'Calle 1', city: 'Madrid', postalCode: '28001', country: 'ES' },
    acceptTerms: true,
    idempotencyKey: `qa-${Date.now()}-abcdefgh`,
    locale: 'es',
  };
  const r = await fetch(`${BASE}/api/checkout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(r.status, 409);
});

test('formularios públicos: antispam y validación', async () => {
  const base = { fullName: 'QA', company: 'QA SL', email: 'x@qa.test.local', country: 'ES', phone: '600000000', product: 'cpo', volume: '1 t', consent: true, locale: 'es' };
  const post = (b) => fetch(`${BASE}/api/quote`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
  assert.equal((await post({ ...base, email: 'malo' })).status, 422);
  assert.equal((await post(base)).status, 400, 'sin token de formulario');
  assert.equal((await post({ ...base, website: 'http://spam', ft: '1.x' })).status, 400, 'campo trampa');
});

test('cotización real, XSS escapado en el panel y límite por IP (X-Forwarded-For no lo evita)', async () => {
  await run("DELETE FROM rate_limits WHERE key LIKE 'quote:%'");
  const html = await (await fetch(`${BASE}/es/`)).text();
  const ft = html.match(/name="ft" value="([^"]+)"/)[1];
  await new Promise((r) => setTimeout(r, 2700));
  const payload = { fullName: '<img src=x onerror=alert(1)>', company: 'QA SL', email: 'xss@qa.test.local', country: 'ES', phone: '600000000', product: 'cpo', volume: '1 t', consent: true, locale: 'es', ft, website: '' };
  const ok = await fetch(`${BASE}/api/quote`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal(ok.status, 200);
  const { ref } = await ok.json();
  assert.match(ref, /^MQ-\d{2}-[A-Z0-9]{7}$/);

  const admin = new Client();
  assert.equal((await admin.login(USERS.admin)).status, 303);
  const list = await (await admin.req('/admin/cotizaciones')).text();
  assert.ok(list.includes('&lt;img src=x onerror=alert(1)&gt;'), 'el nombre se muestra escapado');
  assert.equal(list.includes('<img src=x onerror'), false);

  let last = 0;
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${BASE}/api/quote`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${i}` }, body: JSON.stringify({ ...payload, email: `rl${i}@qa.test.local` }) });
    last = r.status;
  }
  assert.equal(last, 429);
});

test('sesión: cookie HttpOnly + SameSite=Strict y cierre de sesión', async () => {
  const c = new Client();
  const res = await c.login(USERS.viewer);
  const cookie = (res.headers.getSetCookie?.() ?? []).find((s) => /morano_admin=/.test(s)) || '';
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.match(cookie, /Path=\//i);
  assert.equal((await c.req('/admin')).status, 200);
  const csrf = await c.csrf('/admin');
  assert.equal((await c.form('/admin/logout', { _csrf: csrf })).status, 303);
  assert.equal((await c.req('/admin')).status, 303, 'tras cerrar sesión ya no entra');
});

test('roles: consulta y comercial no acceden a lo que no les corresponde', async () => {
  const viewer = new Client();
  await viewer.login(USERS.viewer);
  assert.equal((await viewer.req('/admin/pedidos')).status, 200);
  assert.equal((await viewer.req('/admin/usuarios')).status, 403);
  assert.equal((await viewer.req('/admin/ajustes')).status, 403);
  assert.equal((await viewer.req('/admin/contenido')).status, 403);
  assert.equal((await viewer.req('/admin/productos/nuevo')).status, 403);

  // Escritura forzada por POST (sin botón en la interfaz): el servidor la rechaza.
  const v = await get('SELECT id, price_cents FROM variants ORDER BY id LIMIT 1');
  const csrf = await viewer.csrf('/admin/inventario');
  const html = await (await viewer.form('/admin/inventario', { _csrf: csrf, vid: String(v.id), [`price_${v.id}`]: '0,01' })).text();
  assert.match(html, /no permite/);
  assert.equal((await get('SELECT price_cents FROM variants WHERE id = ?', [v.id])).price_cents, v.price_cents);

  const sales = new Client();
  await sales.login(USERS.sales);
  assert.equal((await sales.req('/admin/cotizaciones')).status, 200);
  assert.equal((await sales.req('/admin/usuarios')).status, 403);
  const csrfS = await sales.csrf('/admin/productos/1');
  const r = await sales.form('/admin/productos/1', { _csrf: csrfS, action: 'product_delete', confirmed: '1' });
  assert.match(await r.text(), /no permite/);
  assert.ok(await get('SELECT id FROM products WHERE id = 1'), 'el producto sigue existiendo');
});

test('CSRF del panel: sin token válido no se modifica nada', async () => {
  const admin = new Client();
  await admin.login(USERS.admin);
  const before = await get("SELECT value FROM settings WHERE key = 'lowStockDefault'");
  const html = await (await admin.form('/admin/ajustes', { _csrf: 'token-falso', vatRate: '21', pricesIncludeVat: '1', lowStockDefault: '999' })).text();
  assert.match(html, /caducado/);
  const after = await get("SELECT value FROM settings WHERE key = 'lowStockDefault'");
  assert.deepEqual(after, before);
});

test('fuerza bruta: la cuenta se bloquea tras 5 intentos fallidos', async () => {
  const c = new Client();
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await c.login(USERS.lock, 'contraseña-mala')).status);
  assert.deepEqual(statuses.slice(0, 4), [401, 401, 401, 401]);
  assert.equal(statuses[4], 429, 'quinto intento → bloqueo');
  assert.equal((await c.login(USERS.lock, PW)).status, 429, 'ni con la contraseña correcta mientras dure el bloqueo');
  const u = await get('SELECT locked_until FROM users WHERE email = ?', [USERS.lock]);
  assert.ok(u.locked_until > Date.now());
  const audits = await all("SELECT action FROM audit_log WHERE user_email = ? AND action LIKE 'login.%'", [USERS.lock]);
  assert.ok(audits.length >= 5, 'intentos registrados en la auditoría');
});

test('rutas con entradas maliciosas devuelven 404, no errores', async () => {
  for (const p of ["/es/productos/'%20OR%201=1--", '/es/productos/..%2F..%2Fetc%2Fpasswd', '/media/..%2F.env', '/es/pedido/ME-26-AAAAAAA?t=%27%22%3E%3Cscript%3E']) {
    const r = await fetch(BASE + p);
    assert.ok([404, 400].includes(r.status), `${p} → ${r.status}`);
  }
  assert.equal((await fetch(`${BASE}/.env`)).status, 404);
  assert.equal((await fetch(`${BASE}/data/morano.db`)).status, 404);
});

test('SEO técnico: robots, sitemap con hreflang y redirección por idioma', async () => {
  const robots = await (await fetch(`${BASE}/robots.txt`)).text();
  assert.match(robots, /Disallow: \/admin/);
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
