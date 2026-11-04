// Registro de actividad administrativa y alertas de seguridad.
import { config } from './config.ts';
import { run } from './db.ts';
import { log } from './log.ts';
import { sendMail, layout, esc } from './mail.ts';
import { consume } from './security/ratelimit.ts';

export async function audit(
  actor: { id?: number; email?: string } | null,
  action: string,
  entity?: string,
  entityId?: string | number,
  detail: Record<string, unknown> = {},
  ipHash?: string
) {
  try {
    await run(
      'INSERT INTO audit_log (at, user_id, user_email, action, entity, entity_id, detail, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [Date.now(), actor?.id ?? null, actor?.email ?? null, action, entity ?? null, entityId === undefined ? null : String(entityId), JSON.stringify(detail).slice(0, 4000), ipHash ?? null]
    );
  } catch (e) {
    log.error('audit', e);
  }
}

/** Alerta de actividad sospechosa: log + correo (máximo uno cada 15 min por tipo). */
export async function securityAlert(type: string, detail: Record<string, unknown>) {
  log.warn(`security.${type}`, detail);
  try {
    const gate = await consume(`alert:${type}`, 1, 900);
    if (!gate.ok || !config.mail.alert) return;
    const rows = Object.entries(detail)
      .map(([k, v]) => `<li><strong>${esc(k)}</strong>: ${esc(typeof v === 'string' ? v : JSON.stringify(v))}</li>`)
      .join('');
    await sendMail({
      to: config.mail.alert,
      subject: `[Morano Europe] Alerta de seguridad: ${type}`,
      text: `Alerta: ${type}\n${JSON.stringify(detail, null, 2)}`,
      html: layout('Alerta de seguridad', `<p>Se ha detectado: <strong>${esc(type)}</strong></p><ul>${rows}</ul><p>Revise el registro de actividad del panel.</p>`),
      template: 'security-alert',
    });
  } catch (e) {
    log.error('security.alert', e);
  }
}
