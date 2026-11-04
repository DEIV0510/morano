// Copia de seguridad consistente de la base de datos local (SQLite/libSQL).
// Usa VACUUM INTO: copia en caliente, sin detener el servidor.
// Conserva las últimas N copias (BACKUP_KEEP, por defecto 30).
//
// Uso: npm run db:backup            (programarlo a diario: cron / Programador de tareas)
// Con Turso (DATABASE_URL libsql://…) las copias y la restauración a un punto
// en el tiempo las gestiona Turso: ver docs/OPERACION.md.
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/lib/config.ts';
import { db } from '../src/lib/db.ts';

if (!config.db.url.startsWith('file:')) {
  console.error('DATABASE_URL no es un archivo local: use las copias de seguridad de Turso (ver docs/OPERACION.md).');
  process.exit(1);
}
const dir = process.env.BACKUP_DIR || 'backups';
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const target = join(dir, `morano-${stamp}.db`);
const c = await db();
await c.execute({ sql: 'VACUUM INTO ?', args: [target] });
console.log(`Copia creada: ${target} (${(statSync(target).size / 1024).toFixed(0)} KB)`);

const keep = Number(process.env.BACKUP_KEEP || 30);
const files = readdirSync(dir).filter((f) => /^morano-.*\.db$/.test(f)).sort();
for (const f of files.slice(0, Math.max(0, files.length - keep))) {
  rmSync(join(dir, f));
  console.log(`Eliminada copia antigua: ${f}`);
}
process.exit(0);
