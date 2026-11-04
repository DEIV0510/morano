// Solicitudes de cotización y mensajes de contacto.
import { config } from './config.ts';
import { countryName } from './countries.ts';
import { pushToCrm } from './crm.ts';
import { run } from './db.ts';
import { CATALOGO } from '../data/catalogo.ts';
import { log } from './log.ts';
import { esc, layout, sendMail, table, textTable } from './mail.ts';
import { hashIp, publicRef } from './security/crypto.ts';
import type { ContactInput, QuoteInput } from './validation.ts';
import { ApiError } from './http.ts';

async function insertWithRef(prefix: string, sql: string, args: (ref: string) => unknown[]) {
  for (let i = 0; i < 5; i++) {
    const ref = publicRef(prefix);
    try {
      await run(sql, args(ref) as any);
      return ref;
    } catch (e: any) {
      if (!String(e?.message).includes('UNIQUE') || i === 4) throw e;
    }
  }
  throw new Error('No se pudo generar la referencia');
}

export async function createQuote(q: QuoteInput, ip: string) {
  const def = CATALOGO.find((p) => p.slug === q.product);
  const product =
    q.product === 'other'
      ? { label: q.locale === 'es' ? 'Otro / varios productos' : 'Other / several products' }
      : def
        ? { label: `${def.code} — ${def.name[q.locale]}` }
        : undefined;
  if (!product) throw new ApiError(422, 'validation_error', 'Invalid data', { fields: { product: 'invalid_product' } });

  const now = Date.now();
  const ref = await insertWithRef(
    'MQ',
    `INSERT INTO quotes (ref, full_name, company, email, country, phone, product_slug, product_label, volume, needs, locale, ip_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    (ref) => [ref, q.fullName, q.company, q.email, q.country, q.phone, q.product, product.label, q.volume, q.needs, q.locale, hashIp(ip), now, now]
  );

  (async () => {
    const rows: [string, string][] = [
      ['Referencia', ref],
      ['Nombre', q.fullName],
      ['Empresa', q.company],
      ['Correo', q.email],
      ['Teléfono', q.phone],
      ['País', countryName(q.country, 'es')],
      ['Producto', product.label],
      ['Volumen', q.volume],
      ['Necesidades', q.needs || '—'],
      ['Idioma', q.locale.toUpperCase()],
    ];
    await sendMail({
      to: config.mail.sales,
      replyTo: q.email,
      subject: `Nueva cotización ${ref}: ${product.label} — ${q.company}`,
      text: textTable(rows),
      html: layout('Nueva solicitud de cotización', `<p>Nueva solicitud de cotización desde la web.</p>${table(rows)}<p>Responda a este correo para contactar directamente con el cliente.</p>`),
      template: 'quote-sales',
      related: ref,
    });
    const es = q.locale === 'es';
    const subject = es ? `Solicitud ${ref} recibida — Morano Europe` : `Request ${ref} received — Morano Europe`;
    const body = es
      ? `Gracias por su interés en Morano Europe. Hemos recibido su solicitud de cotización para ${product.label} (referencia ${ref}). Nuestro equipo comercial le responderá por este medio.`
      : `Thank you for your interest in Morano Europe. We have received your quotation request for ${product.label} (reference ${ref}). Our commercial team will reply by email.`;
    await sendMail({ to: q.email, subject, text: body, html: layout(subject, `<p>${esc(q.fullName)},</p><p>${esc(body)}</p>`), template: 'quote-ack', related: ref });
    const crm = await pushToCrm('quote', { ref, fullName: q.fullName, company: q.company, email: q.email, phone: q.phone, country: q.country, product: product.label, productSlug: q.product, volume: q.volume, needs: q.needs, locale: q.locale });
    await run('UPDATE quotes SET crm_status = ? WHERE ref = ?', [crm, ref]);
  })().catch((e) => log.error('quote.notify', e));

  return ref;
}

export async function createMessage(m: ContactInput, ip: string) {
  const now = Date.now();
  const ref = await insertWithRef(
    'MC',
    `INSERT INTO messages (ref, full_name, company, email, phone, country, message, locale, ip_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    (ref) => [ref, m.fullName, m.company, m.email, m.phone, m.country, m.message, m.locale, hashIp(ip), now, now]
  );
  (async () => {
    const rows: [string, string][] = [
      ['Referencia', ref],
      ['Nombre', m.fullName],
      ['Empresa', m.company || '—'],
      ['Correo', m.email],
      ['Teléfono', m.phone || '—'],
      ['País', m.country ? countryName(m.country, 'es') : '—'],
      ['Mensaje', m.message],
    ];
    await sendMail({
      to: config.mail.sales,
      replyTo: m.email,
      subject: `Nuevo mensaje ${ref} — ${m.fullName}${m.company ? ` (${m.company})` : ''}`,
      text: textTable(rows),
      html: layout('Nuevo mensaje de contacto', `${table(rows)}<p>Responda a este correo para contactar directamente con el remitente.</p>`),
      template: 'contact-sales',
      related: ref,
    });
    const es = m.locale === 'es';
    const subject = es ? `Hemos recibido su mensaje (${ref})` : `We have received your message (${ref})`;
    const body = es
      ? 'Gracias por escribir a Morano Europe. Nuestro equipo comercial le responderá pronto.'
      : 'Thank you for contacting Morano Europe. Our commercial team will reply soon.';
    await sendMail({ to: m.email, subject, text: body, html: layout(subject, `<p>${esc(m.fullName)},</p><p>${esc(body)}</p>`), template: 'contact-ack', related: ref });
    const crm = await pushToCrm('contact', { ref, fullName: m.fullName, company: m.company, email: m.email, phone: m.phone, country: m.country, message: m.message, locale: m.locale });
    await run('UPDATE messages SET crm_status = ? WHERE ref = ?', [crm, ref]);
  })().catch((e) => log.error('contact.notify', e));
  return ref;
}
