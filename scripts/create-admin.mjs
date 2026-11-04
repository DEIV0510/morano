// Crea (o restablece) un usuario del panel desde la terminal del servidor.
// La contraseña se pide por teclado y no queda en el historial de la shell.
//
// Uso:  npm run admin:create -- correo@empresa.com "Nombre" [rol]
// Roles: admin | manager | sales | viewer   (por defecto: admin)
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { migrate } from '../src/lib/migrate.ts';
import { get, run } from '../src/lib/db.ts';
import { hashPassword } from '../src/lib/security/crypto.ts';
import { passwordProblem, ROLES } from '../src/lib/auth.ts';

const [email, name = 'Administrador', role = 'admin'] = process.argv.slice(2);
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Uso: npm run admin:create -- correo@empresa.com "Nombre" [admin|manager|sales|viewer]');
  process.exit(1);
}
if (!ROLES.includes(role)) {
  console.error(`Rol no válido: ${role}. Opciones: ${ROLES.join(', ')}`);
  process.exit(1);
}

async function askHidden(prompt) {
  // Contraseña por variable de entorno (útil en despliegues automatizados).
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  let muted = false;
  const out = new Writable({ write(chunk, enc, cb) { if (!muted) process.stdout.write(chunk, enc); cb(); } });
  const rl = createInterface({ input: process.stdin, output: out, terminal: true });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
    muted = true;
  });
}

await migrate();
const pw = await askHidden('Contraseña (mín. 12 caracteres): ');
const problem = passwordProblem(pw, email);
if (problem) {
  console.error(`Contraseña rechazada: ${problem}`);
  process.exit(1);
}
const hash = await hashPassword(pw);
const now = Date.now();
const existing = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
if (existing) {
  await run('UPDATE users SET name = ?, role = ?, password_hash = ?, active = 1, failed_count = 0, locked_until = 0, password_changed_at = ? WHERE id = ?', [name, role, hash, now, existing.id]);
  await run('DELETE FROM sessions WHERE user_id = ?', [existing.id]);
  console.log(`Usuario actualizado: ${email} (${role}). Sesiones anteriores cerradas.`);
} else {
  await run('INSERT INTO users (email, name, role, password_hash, active, password_changed_at, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)', [email.toLowerCase(), name, role, hash, now, now]);
  console.log(`Usuario creado: ${email} (${role}).`);
}
process.exit(0);
