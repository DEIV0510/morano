// Correo transaccional por SMTP. Si no hay SMTP configurado, el correo no se
// envía y queda registrado como "skipped" en el panel (nunca se finge el envío).
import nodemailer, { type Transporter } from 'nodemailer';
import { config, contact, smtpConfigured } from './config.ts';
import { run } from './db.ts';
import { log } from './log.ts';

let transport: Transporter | undefined;

function getTransport(): Transporter {
  transport ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    tls: { minVersion: 'TLSv1.2' },
  });
  return transport;
}

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  template: string;
  related?: string;
}

export async function sendMail(m: Mail): Promise<'sent' | 'failed' | 'skipped'> {
  let status: 'sent' | 'failed' | 'skipped' = 'skipped';
  let error = '';
  if (!m.to) {
    error = 'sin destinatario configurado';
  } else if (!smtpConfigured()) {
    error = 'SMTP sin configurar';
  } else {
    try {
      await getTransport().sendMail({
        from: config.mail.from,
        to: m.to,
        replyTo: m.replyTo,
        subject: m.subject.replace(/[\r\n]+/g, ' ').slice(0, 200),
        text: m.text,
        html: m.html,
      });
      status = 'sent';
    } catch (e) {
      status = 'failed';
      error = e instanceof Error ? e.message.slice(0, 300) : 'error';
      log.error('mail.send', { template: m.template, error });
    }
  }
  try {
    await run('INSERT INTO email_log (at, recipient, template, subject, status, error, related) VALUES (?, ?, ?, ?, ?, ?, ?)', [
      Date.now(), m.to || '-', m.template, m.subject.slice(0, 200), status, error, m.related ?? '',
    ]);
  } catch (e) {
    log.error('mail.log', e);
  }
  return status;
}

/** Plantilla HTML sobria con la identidad de la marca (sin imágenes remotas). */
export function layout(title: string, bodyHtml: string, footerNote = ''): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f3f4f5;font-family:Arial,Helvetica,sans-serif;color:#0a1a33">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f5;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-top:4px solid #0C2750">
<tr><td style="padding:28px 32px 8px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0C2750">Morano <span style="color:#CA9E31">Europe</span></td></tr>
<tr><td style="padding:8px 32px 28px;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #cbcdd0;font-size:12px;line-height:1.5;color:#5f6064">${esc(contact.company)} · ${esc(contact.address)}<br>WhatsApp ${esc(contact.whatsapp)} · ${esc(contact.web)}${footerNote ? `<br>${footerNote}` : ''}</td></tr>
</table></td></tr></table></body></html>`;
}

export function table(rows: [string, string][]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:12px 0">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #e3e4e6;color:#5f6064;width:38%;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;border-bottom:1px solid #e3e4e6;white-space:pre-wrap">${esc(v)}</td></tr>`
    )
    .join('')}</table>`;
}

export const textTable = (rows: [string, string][]) => rows.map(([k, v]) => `${k}: ${v}`).join('\n');
