// Pruebas unitarias de las piezas de seguridad (sin servidor ni base de datos).
// Ejecutar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

process.env.APP_SECRET ||= 'unit-test-secret-unit-test-secret-unit-test-secret';

const { hashPassword, verifyPassword, encrypt, decrypt, safeEqual, publicRef } = await import('../../src/lib/security/crypto.ts');
const { hotp, verifyTotp, base32Encode, base32Decode, currentStep } = await import('../../src/lib/security/totp.ts');
const { verifyStripeSignature } = await import('../../src/lib/payments/stripe.ts');
const { issueFormToken, checkSpam } = await import('../../src/lib/security/antispam.ts');
const { passwordProblem, can } = await import('../../src/lib/auth.ts');

test('scrypt: verifica la contraseña correcta y rechaza la incorrecta', async () => {
  const h = await hashPassword('Frase-Larga-De-Prueba-2026');
  assert.match(h, /^scrypt\$131072\$8\$1\$/);
  assert.equal(await verifyPassword('Frase-Larga-De-Prueba-2026', h), true);
  assert.equal(await verifyPassword('frase-larga-de-prueba-2026', h), false);
  assert.equal(await verifyPassword('x', 'formato-invalido'), false);
  assert.notEqual(h, await hashPassword('Frase-Larga-De-Prueba-2026'), 'cada hash lleva sal distinta');
});

test('AES-256-GCM: cifra, descifra y detecta manipulación', () => {
  const c = encrypt('JBSWY3DPEHPK3PXP');
  assert.equal(decrypt(c), 'JBSWY3DPEHPK3PXP');
  const parts = c.split('.');
  parts[2] = parts[2].slice(0, -2) + (parts[2].endsWith('A') ? 'BB' : 'AA');
  assert.throws(() => decrypt(parts.join('.')));
});

test('comparación en tiempo constante', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
});

test('TOTP: vector oficial RFC 6238 y bloqueo de reutilización', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  assert.equal(secret, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.equal(base32Decode(secret).toString(), '12345678901234567890');
  // RFC 6238: T=59 s → 94287082 (8 dígitos) → 287082 con 6 dígitos.
  assert.equal(hotp(secret, Math.floor(59 / 30)), '287082');
  const now = 1_800_000_000_000;
  const code = hotp(secret, currentStep(now));
  const step = verifyTotp(secret, code, 0, now);
  assert.equal(step, currentStep(now));
  assert.equal(verifyTotp(secret, code, step, now), null, 'el mismo código no vale dos veces');
  assert.equal(verifyTotp(secret, '000000', 0, now) === null || hotp(secret, currentStep(now)) === '000000', true);
  assert.equal(verifyTotp(secret, 'abcdef', 0, now), null);
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

test('política de contraseñas del panel', () => {
  assert.ok(passwordProblem('corta1A!'));
  assert.ok(passwordProblem('solominusculaslarga'));
  assert.ok(passwordProblem('Morano-Europe-2026', 'x@y.com'), 'palabras previsibles');
  assert.equal(passwordProblem('Tres-Palomas-Vuelan-77'), null);
});

test('permisos por rol (matriz del servidor)', () => {
  assert.equal(can('admin', 'users:manage'), true);
  assert.equal(can('manager', 'users:manage'), false);
  assert.equal(can('manager', 'catalog:write'), true);
  assert.equal(can('sales', 'catalog:write'), false);
  assert.equal(can('sales', 'orders:write'), true);
  assert.equal(can('viewer', 'orders:write'), false);
  assert.equal(can('viewer', 'orders:read'), true);
  assert.equal(can(undefined, 'dashboard:view'), false);
});

test('referencias públicas no secuenciales', () => {
  const a = publicRef('ME');
  assert.match(a, /^ME-\d{2}-[A-Z0-9]{7}$/);
  assert.notEqual(a, publicRef('ME'));
});
