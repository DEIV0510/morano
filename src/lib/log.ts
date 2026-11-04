// Registro estructurado en stdout (lo recoge el hosting o el gestor de procesos).
// Nunca registra contraseñas, tokens, cookies, cabeceras de autorización ni
// datos de tarjeta: las claves sensibles se sustituyen por "[redacted]".
const SENSITIVE = /pass(word)?|token|secret|authorization|cookie|card|cvc|iban|totp|code|signature/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack?.split('\n').slice(0, 6).join('\n') };
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE.test(k) ? '[redacted]' : redact(v, depth + 1);
  }
  return out;
}

function write(level: 'info' | 'warn' | 'error', where: string, detail?: unknown) {
  const line = JSON.stringify({ t: new Date().toISOString(), level, where, detail: redact(detail) });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info: (where: string, detail?: unknown) => write('info', where, detail),
  warn: (where: string, detail?: unknown) => write('warn', where, detail),
  error: (where: string, detail?: unknown) => write('error', where, detail),
};
