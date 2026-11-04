// Aplica las migraciones SQL de db/migrations en orden, una sola vez cada una.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from './db.ts';

export async function migrate(dir = join(process.cwd(), 'db', 'migrations')) {
  const c = await db();
  await c.execute(
    'CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)'
  );
  const done = new Set(
    (await c.execute('SELECT name FROM _migrations')).rows.map((r) => String(r.name))
  );
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const f of files) {
    if (done.has(f)) continue;
    const sql = readFileSync(join(dir, f), 'utf8');
    await c.executeMultiple(sql);
    await c.execute({ sql: 'INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', args: [f, Date.now()] });
    applied.push(f);
  }
  return applied;
}
