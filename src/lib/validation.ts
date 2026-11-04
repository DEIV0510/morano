// Esquemas de validación del servidor. Toda entrada externa pasa por aquí
// antes de tocar la base de datos, el correo o Stripe.
import { z } from 'astro/zod';
import { L, PHONE_RE } from './limits.ts';
import { isCountry } from './countries.ts';
import { ApiError } from './http.ts';

// Texto de una línea: sin caracteres de control ni saltos (evita inyección en cabeceras de correo).
const line = (min: number, max: number) =>
  z
    .string()
    .transform((s) => s.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(min).max(max));

// Texto multilínea: conserva saltos de línea, elimina otros caracteres de control.
const multi = (min: number, max: number) =>
  z
    .string()
    .transform((s) => s.normalize('NFC').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim())
    .pipe(z.string().min(min).max(max));

// Opcional: admite ausente, null o vacío y devuelve siempre un string.
const optLine = (max: number) => line(0, max).nullish().transform((v) => v ?? '');

export const email = z
  .string()
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.string().max(L.email.max).pipe(z.email()));

const phone = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().regex(PHONE_RE));

const country = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .refine(isCountry, 'invalid_country');

const locale = z.enum(['es', 'en']).catch('es');

const consent = z.literal(true);

const antiBot = {
  website: z.string().max(200).optional(), // campo trampa
  ft: z.string().max(80).optional(), // token de formulario
};

export const quoteSchema = z.object({
  fullName: line(L.name.min, L.name.max),
  company: line(L.company.min, L.company.max),
  email,
  country,
  phone,
  product: z.string().regex(/^[a-z0-9-]{2,64}$/),
  volume: line(L.volume.min, L.volume.max),
  needs: multi(0, L.needs.max).nullish().transform((v) => v ?? ''),
  consent,
  locale,
  ...antiBot,
});
export type QuoteInput = z.infer<typeof quoteSchema>;

export const contactSchema = z.object({
  fullName: line(L.name.min, L.name.max),
  company: optLine(L.company.max),
  email,
  phone: z.union([z.literal(''), phone]).nullish().transform((v) => v ?? ''),
  country: z.union([z.literal(''), country]).nullish().transform((v) => v ?? ''),
  message: multi(L.message.min, L.message.max),
  consent,
  locale,
  ...antiBot,
});
export type ContactInput = z.infer<typeof contactSchema>;

export const cartSchema = z.object({
  items: z
    .array(
      z.object({
        sku: z.string().regex(/^[A-Z0-9-]{2,40}$/),
        qty: z.number().int().min(L.qty.min).max(L.qty.max),
      })
    )
    .max(L.cartLines.max),
});
export type CartInput = z.infer<typeof cartSchema>;

export const checkoutSchema = cartSchema.extend({
  customer: z.object({
    fullName: line(L.name.min, L.name.max),
    company: optLine(L.company.max),
    taxId: optLine(L.taxId.max),
    email,
    phone,
    address1: line(L.address.min, L.address.max),
    address2: optLine(L.address.max),
    city: line(L.city.min, L.city.max),
    postalCode: line(L.postal.min, L.postal.max),
    region: optLine(L.region.max),
    country,
    notes: multi(0, L.notes.max).nullish().transform((v) => v ?? ''),
  }),
  acceptTerms: z.literal(true),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  locale,
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Valida y lanza ApiError(422) con los campos erróneos (sin eco de valores). */
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.code;
  }
  throw new ApiError(422, 'validation_error', 'Invalid data', { fields });
}
