// Pruebas unitarias de las piezas de seguridad (sin servidor ni base de datos).
// Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

process.env.APP_SECRET ||= 'unit-test-secret-unit-test-secret-unit-test-secret';

const { safeEqual, publicRef, hashIp, sign } = await import('../../src/lib/security/crypto.ts');
const { verifyStripeSignature } = await import('../../src/lib/payments/stripe.ts');
const { issueFormToken, checkSpam } = await import('../../src/lib/security/antispam.ts');
const { esc } = await import('../../src/lib/mail.ts');

test('comparación en tiempo constante', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
});

test('IP seudonimizada: estable, no reversible y distinta por propósito', () => {
  const a = hashIp('203.0.113.7');
  assert.equal(a, hashIp('203.0.113.7'));
  assert.notEqual(a, hashIp('203.0.113.8'));
  assert.equal(a.includes('203'), false);
  assert.notEqual(sign('x', 'form-token'), sign('x', 'otro'));
});

test('Stripe: firma válida, manipulada, caducada y ausente', () => {
  const secret = 'whsec_test_123';
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
  const t = 1_800_000_000;
  const sig = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  assert.equal(verifyStripeSignature(payload, `t=${t},v1=${sig}`, secret, 300, t + 10), true);
  assert.equal(verifyStripeSignature(payload.replace('evt_1', 'evt_2'), `t=${t},v1=${sig}`, secret, 300, t + 10), false);
  assert.equal(verifyStripeSignature(payload, `t=${t},v1=${sig}`, secret, 300, t + 301), false, 'reenvío fuera de tolerancia');
  assert.equal(verifyStripeSignature(payload, `t=${t},v1=${sig}`, 'whsec_otro', 300, t), false);
  assert.equal(verifyStripeSignature(payload, null, secret), false);
  assert.equal(verifyStripeSignature(payload, `t=${t},v0=${sig}`, secret, 300, t), false);
});

test('antispam: campo trampa, envío demasiado rápido, token falso y válido', () => {
  const now = Date.now();
  const token = issueFormToken(now - 10_000);
  assert.deepEqual(checkSpam({ token, honeypot: '' }, now), { ok: true });
  assert.equal(checkSpam({ token, honeypot: 'http://spam' }, now).ok, false);
  assert.equal(checkSpam({ token: issueFormToken(now - 500) }, now).ok, false);
  assert.equal(checkSpam({ token: `${now - 10_000}.deadbeefdeadbeefdeadbeefdeadbeef` }, now).ok, false);
  assert.equal(checkSpam({ token, text: 'http://a http://b http://c http://d' }, now).ok, false);
});

test('correos: el contenido de los clientes se escapa (sin HTML inyectado)', () => {
  assert.equal(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(esc('"\'&'), '&quot;&#39;&amp;');
});

test('referencias públicas no secuenciales', () => {
  const a = publicRef('ME');
  assert.match(a, /^ME-\d{2}-[A-Z0-9]{7}$/);
  assert.notEqual(a, publicRef('ME'));
});
