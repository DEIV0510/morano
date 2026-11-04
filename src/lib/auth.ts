// Autenticación y autorización del panel administrativo.
// - Contraseñas con scrypt; sesiones opacas en BD (solo se guarda el hash).
// - Cookie HttpOnly + Secure + SameSite=Strict, prefijo __Host- en HTTPS.
// - Bloqueo progresivo por cuenta y por IP; MFA TOTP opcional por usuario.
// - Permisos comprobados en el servidor en cada página y acción.
import { config } from './config.ts';
import { get, run } from './db.ts';
import { audit, securityAlert } from './audit.ts';
import { decrypt, dummyHash, hashIp, randomToken, safeEqual, sha256, verifyPassword } from './security/crypto.ts';
import { clear, consume, LIMITS } from './security/ratelimit.ts';
import { verifyTotp } from './security/totp.ts';

export const ROLES = ['admin', 'manager', 'sales', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  manager: 'Gestor de catálogo y contenidos',
  sales: 'Comercial',
  viewer: 'Consulta (solo lectura)',
};

export const PERMISSIONS = {
  'dashboard:view': ['admin', 'manager', 'sales', 'viewer'],
  'catalog:read': ['admin', 'manager', 'sales', 'viewer'],
  'catalog:write': ['admin', 'manager'],
  'catalog:delete': ['admin'],
  'inventory:write': ['admin', 'manager'],
  'orders:read': ['admin', 'manager', 'sales', 'viewer'],
  'orders:write': ['admin', 'manager', 'sales'],
  'quotes:read': ['admin', 'manager', 'sales', 'viewer'],
  'quotes:write': ['admin', 'manager', 'sales'],
  'messages:read': ['admin', 'manager', 'sales', 'viewer'],
  'messages:write': ['admin', 'manager', 'sales'],
  'content:write': ['admin', 'manager'],
  'settings:write': ['admin'],
  'users:manage': ['admin'],
  'audit:read': ['admin'],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export const can = (role: Role | undefined, p: Permission) => !!role && (PERMISSIONS[p] as readonly Role[]).includes(role);

export interface UserRow {
  id: number;
  email: string;
  name: string;
  role: Role;
  password_hash: string;
  active: number;
  must_change_password: number;
  mfa_secret_enc: string | null;
  mfa_enabled: number;
  mfa_last_step: number;
  failed_count: number;
  locked_until: number;
  password_changed_at: number;
  last_login_at: number | null;
  created_at: number;
}

export interface SessionRow {
  id_hash: string;
  user_id: number;
  csrf: string;
  mfa_pending: number;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
}

export type AdminUser = Pick<UserRow, 'id' | 'email' | 'name' | 'role' | 'mfa_enabled' | 'must_change_password'>;

export const COOKIE = config.secureCookies ? '__Host-morano_admin' : 'morano_admin';
const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
const IDLE_MS = 2 * 60 * 60 * 1000;
const MFA_PENDING_MS = 10 * 60 * 1000;
const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60 * 1000;

export const cookieOptions = (maxAgeSec?: number) => ({
  httpOnly: true,
  secure: config.secureCookies,
  sameSite: 'strict' as const,
  path: '/',
  ...(maxAgeSec !== undefined ? { maxAge: maxAgeSec } : {}),
});

export async function createSession(userId: number, mfaPending: boolean, ip: string, ua: string) {
  const token = randomToken(32);
  const now = Date.now();
  await run(
    'INSERT INTO sessions (id_hash, user_id, csrf, mfa_pending, created_at, last_seen_at, expires_at, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [sha256(token), userId, randomToken(24), mfaPending ? 1 : 0, now, now, now + (mfaPending ? MFA_PENDING_MS : ABSOLUTE_MS), hashIp(ip), ua.slice(0, 200)]
  );
  return token;
}

export async function loadSession(token: string | undefined): Promise<{ session: SessionRow; user: AdminUser } | null> {
  if (!token || token.length < 30 || token.length > 64) return null;
  const now = Date.now();
  const row = await get<SessionRow & AdminUser & { active: number }>(
    `SELECT s.*, u.email, u.name, u.role, u.active, u.mfa_enabled, u.must_change_password, u.id AS id
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?`,
    [sha256(token)]
  );
  if (!row) return null;
  if (!row.active || row.expires_at <= now || (!row.mfa_pending && now - row.last_seen_at > IDLE_MS)) {
    await run('DELETE FROM sessions WHERE id_hash = ?', [row.id_hash]);
    return null;
  }
  if (now - row.last_seen_at > 60_000) await run('UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?', [now, row.id_hash]);
  const session: SessionRow = {
    id_hash: row.id_hash, user_id: row.user_id, csrf: row.csrf, mfa_pending: row.mfa_pending,
    created_at: row.created_at, last_seen_at: row.last_seen_at, expires_at: row.expires_at,
  };
  const user: AdminUser = { id: row.user_id, email: row.email, name: row.name, role: row.role, mfa_enabled: row.mfa_enabled, must_change_password: row.must_change_password };
  return { session, user };
}

export async function destroySession(token: string | undefined) {
  if (token) await run('DELETE FROM sessions WHERE id_hash = ?', [sha256(token)]);
}

export async function destroyUserSessions(userId: number, exceptHash?: string) {
  if (exceptHash) await run('DELETE FROM sessions WHERE user_id = ? AND id_hash <> ?', [userId, exceptHash]);
  else await run('DELETE FROM sessions WHERE user_id = ?', [userId]);
}

export type LoginResult =
  | { status: 'ok' | 'mfa'; token: string; user: UserRow }
  | { status: 'invalid' | 'locked' | 'rate_limited'; retryAfter?: number };

export async function login(emailRaw: string, password: string, ip: string, ua: string): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase().slice(0, 254);
  const ipH = hashIp(ip);
  const byIp = await consume(`login:ip:${ipH}`, LIMITS.loginIp[0], LIMITS.loginIp[1]);
  if (!byIp.ok) {
    if (byIp.count === LIMITS.loginIp[0] + 1) await securityAlert('login_ip_rate_limited', { ip: ipH });
    return { status: 'rate_limited', retryAfter: byIp.retryAfter };
  }
  const byAccount = await consume(`login:acct:${sha256(email)}`, LIMITS.loginAccount[0] * 2, LIMITS.loginAccount[1]);
  if (!byAccount.ok) return { status: 'rate_limited', retryAfter: byAccount.retryAfter };

  const user = await get<UserRow>('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    await verifyPassword(password, await dummyHash()); // mismo coste que un usuario real
    await audit(null, 'login.failed', 'user', undefined, { reason: 'unknown_user' }, ipH);
    return { status: 'invalid' };
  }
  const now = Date.now();
  if (user.locked_until > now) {
    await audit({ id: user.id, email: user.email }, 'login.blocked', 'user', user.id, {}, ipH);
    return { status: 'locked', retryAfter: Math.ceil((user.locked_until - now) / 1000) };
  }
  const ok = user.active === 1 && (await verifyPassword(password, user.password_hash));
  if (!ok) {
    const failed = user.failed_count + 1;
    const lock = failed >= LOCK_AFTER ? now + LOCK_MS * Math.min(8, 2 ** Math.floor((failed - LOCK_AFTER) / LOCK_AFTER)) : 0;
    await run('UPDATE users SET failed_count = ?, locked_until = ? WHERE id = ?', [failed, lock, user.id]);
    await audit({ id: user.id, email: user.email }, 'login.failed', 'user', user.id, { failed, locked: lock > 0 }, ipH);
    if (lock) await securityAlert('account_locked', { user: user.email, failed });
    return lock ? { status: 'locked', retryAfter: Math.ceil((lock - now) / 1000) } : { status: 'invalid' };
  }
  await run('UPDATE users SET failed_count = 0, locked_until = 0 WHERE id = ?', [user.id]);
  await clear(`login:acct:${sha256(email)}`);
  if (user.mfa_enabled && user.mfa_secret_enc) {
    const token = await createSession(user.id, true, ip, ua);
    await audit({ id: user.id, email: user.email }, 'login.password_ok_mfa_pending', 'user', user.id, {}, ipH);
    return { status: 'mfa', token, user };
  }
  const token = await createSession(user.id, false, ip, ua);
  await run('UPDATE users SET last_login_at = ? WHERE id = ?', [now, user.id]);
  await audit({ id: user.id, email: user.email }, 'login.success', 'user', user.id, {}, ipH);
  return { status: 'ok', token, user };
}

/** Segundo factor: si es correcto, sustituye la sesión pendiente por una completa. */
export async function completeMfa(pendingToken: string, code: string, ip: string, ua: string) {
  const ipH = hashIp(ip);
  const s = await loadSession(pendingToken);
  if (!s || !s.session.mfa_pending) return { status: 'expired' as const };
  const gate = await consume(`mfa:${s.user.id}`, LIMITS.mfa[0], LIMITS.mfa[1]);
  if (!gate.ok) return { status: 'rate_limited' as const, retryAfter: gate.retryAfter };
  const u = await get<UserRow>('SELECT * FROM users WHERE id = ?', [s.user.id]);
  if (!u?.mfa_secret_enc) return { status: 'expired' as const };
  const step = verifyTotp(decrypt(u.mfa_secret_enc), code.replace(/\s+/g, ''), u.mfa_last_step);
  if (step === null) {
    await audit({ id: u.id, email: u.email }, 'login.mfa_failed', 'user', u.id, {}, ipH);
    if (gate.count >= LIMITS.mfa[0]) await securityAlert('mfa_failures', { user: u.email });
    return { status: 'invalid' as const };
  }
  // El intervalo usado queda registrado: el mismo código no vale dos veces.
  const r = await run('UPDATE users SET mfa_last_step = ?, last_login_at = ? WHERE id = ? AND mfa_last_step < ?', [step, Date.now(), u.id, step]);
  if (!r.changes) return { status: 'invalid' as const };
  await destroySession(pendingToken);
  const token = await createSession(u.id, false, ip, ua);
  await audit({ id: u.id, email: u.email }, 'login.success', 'user', u.id, { mfa: true }, ipH);
  return { status: 'ok' as const, token };
}

export function checkCsrf(session: SessionRow, provided: unknown) {
  return typeof provided === 'string' && provided.length > 0 && safeEqual(provided, session.csrf);
}

/** Requisitos de contraseña para administradores. */
export function passwordProblem(pw: string, email = ''): string | null {
  if (pw.length < 12) return 'Mínimo 12 caracteres.';
  if (pw.length > 200) return 'Máximo 200 caracteres.';
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 3) return 'Combine al menos tres de: minúsculas, mayúsculas, números y símbolos.';
  const local = email.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && pw.toLowerCase().includes(local)) return 'No use su correo dentro de la contraseña.';
  if (/^(.)\1+$/.test(pw) || /(password|contraseña|morano|123456|qwerty)/i.test(pw)) return 'Contraseña demasiado previsible.';
  return null;
}
