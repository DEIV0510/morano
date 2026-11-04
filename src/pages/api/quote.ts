// POST /api/quote — solicitud de cotización (validación, antispam, CRM, correo).
import type { APIRoute } from 'astro';
import { ApiError, handler, json } from '../../lib/http.ts';
import { guard, readBody } from '../../lib/public-api.ts';
import { createQuote } from '../../lib/inquiries.ts';
import { checkSpam } from '../../lib/security/antispam.ts';
import { parse, quoteSchema } from '../../lib/validation.ts';
import { log } from '../../lib/log.ts';
import { route } from '../../lib/i18n.ts';

export const POST: APIRoute = handler('api.quote', async (ctx) => {
  const ip = await guard(ctx, 'quote');
  const { data, isForm } = await readBody(ctx.request);
  const input = parse(quoteSchema, data);
  const spam = checkSpam({ honeypot: input.website, token: input.ft, text: `${input.needs} ${input.volume}` });
  if (!spam.ok) {
    log.warn('quote.spam', { reason: spam.reason });
    throw new ApiError(400, 'spam', 'Submission rejected');
  }
  const ref = await createQuote(input, ip);
  if (isForm) return ctx.redirect(`${route('home', input.locale)}?ref=${encodeURIComponent(ref)}#${input.locale === 'es' ? 'contacto' : 'contact'}`, 303);
  return json({ ok: true, ref });
});
