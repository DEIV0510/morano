// Acceso a datos. Todas las consultas son parametrizadas (nunca se concatena
// entrada del usuario en SQL). El cliente vive solo en el servidor.
import { createClient, type Client, type InStatement, type InValue } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { config } from './config.ts';

let client: Client | undefined;
let ready: Promise<void> | undefined;

export type Args = InValue[] | Record<string, InValue>;

function open(): Client {
  if (client) return client;
  if (config.db.url.startsWith('file:')) mkdirSync('data', { recursive: true });
  client = createClient({ url: config.db.url, authToken: config.db.authToken, intMode: 'number' });
  return client;
}

async function init(c: Client) {
  if (config.db.url.startsWith('file:')) {
    await c.execute('PRAGMA journal_mode = WAL');
    await c.execute('PRAGMA busy_timeout = 5000');
  }
  await c.execute('PRAGMA foreign_keys = ON');
}

export async function db(): Promise<Client> {
  const c = open();
  ready ??= init(c);
  await ready;
  return c;
}

function plain<T>(row: Record<string, unknown>, columns: string[]): T {
  const o: Record<string, unknown> = {};
  for (const col of columns) {
    const v = row[col];
    o[col] = v instanceof ArrayBuffer ? new Uint8Array(v) : v;
  }
  return o as T;
}

export async function all<T = Record<string, unknown>>(sql: string, args: Args = []): Promise<T[]> {
  const rs = await (await db()).execute({ sql, args });
  return rs.rows.map((r) => plain<T>(r as unknown as Record<string, unknown>, rs.columns));
}

export async function get<T = Record<string, unknown>>(sql: string, args: Args = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

export async function run(sql: string, args: Args = []) {
  const rs = await (await db()).execute({ sql, args });
  return { changes: rs.rowsAffected, lastId: rs.lastInsertRowid === undefined ? undefined : Number(rs.lastInsertRowid) };
}

/** Ejecuta varias sentencias de forma atómica (todo o nada). */
export async function batch(statements: InStatement[]) {
  return (await db()).batch(statements, 'write');
}

export const now = () => Date.now();
