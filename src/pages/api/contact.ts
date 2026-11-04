// POST /api/contact — mensaje del formulario de contacto empresarial.
import type { APIRoute } from 'astro';
import { ApiError, handler, json } from '../../lib/http.ts';
import { guard, readBody } from '../../lib/public-api.ts';
import { createMessage } from '../../lib/inquiries.ts';
import { checkSpam } from '../../lib/security/antispam.ts';
import { contactSchema, parse } from '../../lib/validation.ts';
import { log } from '../../lib/log.ts';
import { route } from '../../lib/i18n.ts';

export const POST: APIRoute = handler('api.contact', async (ctx) => {
  const ip = await guard(ctx, 'contact');
  const { data, isForm } = await readBody(ctx.request);
  const input = parse(contactSchema, data);
  const spam = checkSpam({ honeypot: input.website, token: input.ft, text: input.message });
  if (!spam.ok) {
    log.warn('contact.spam', { reason: spam.reason });
    throw new ApiError(400, 'spam', 'Submission rejected');
  }
  const ref = await createMessage(input, ip);
  if (isForm) return ctx.redirect(`${route('home', input.locale)}?ref=${encodeURIComponent(ref)}#${input.locale === 'es' ? 'contacto' : 'contact'}`, 303);
  return json({ ok: true, ref });
});
