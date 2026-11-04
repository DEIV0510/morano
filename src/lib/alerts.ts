// Alertas de seguridad (log + correo a ALERT_EMAIL, máximo una cada 15 min por tipo).
import { config } from './config.ts';
import { log } from './log.ts';
import { sendMail, layout, esc } from './mail.ts';
import { consume } from './security/ratelimit.ts';

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
      html: layout('Alerta de seguridad', `<p>Se ha detectado: <strong>${esc(type)}</strong></p><ul>${rows}</ul><p>Revise los registros del servidor.</p>`),
      template: 'security-alert',
    });
  } catch (e) {
    log.error('security.alert', e);
  }
}
