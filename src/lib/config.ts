// Configuración del servidor. Solo se importa desde código de servidor:
// ningún valor de aquí llega al navegador.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// En local se carga .env (las variables ya definidas en el entorno tienen prioridad).
if (existsSync('.env')) {
  try {
    process.loadEnvFile('.env');
  } catch {
    /* .env ilegible: se usan las variables del entorno */
  }
}

const env = (k: string) => (process.env[k] ?? '').trim();

const viteProd = (() => {
  try {
    return Boolean((import.meta as any).env?.PROD);
  } catch {
    return false;
  }
})();

export const isProd = process.env.NODE_ENV === 'production' || viteProd;

function appSecret(): string {
  const s = env('APP_SECRET');
  if (s.length >= 32) return s;
  if (isProd) {
    throw new Error('APP_SECRET falta o es demasiado corto (mínimo 32 caracteres).');
  }
  // Desarrollo: secreto local persistente para no invalidar MFA entre reinicios.
  const file = 'data/.dev-secret';
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  mkdirSync('data', { recursive: true });
  const gen = randomBytes(48).toString('base64url');
  writeFileSync(file, gen, { mode: 0o600 });
  return gen;
}

const siteUrl = (env('SITE_URL') || 'http://localhost:4321').replace(/\/+$/, '');

export const config = {
  siteUrl,
  secureCookies: siteUrl.startsWith('https://'),
  appSecret: appSecret(),
  trustProxy: env('TRUST_PROXY') === '1',
  db: {
    url: env('DATABASE_URL') || 'file:data/morano.db',
    authToken: env('DATABASE_AUTH_TOKEN') || undefined,
  },
  stripe: {
    secretKey: env('STRIPE_SECRET_KEY'),
    webhookSecret: env('STRIPE_WEBHOOK_SECRET'),
  },
  smtp: {
    host: env('SMTP_HOST'),
    port: Number(env('SMTP_PORT') || 465),
    secure: env('SMTP_SECURE') !== '0',
    user: env('SMTP_USER'),
    pass: env('SMTP_PASS'),
  },
  mail: {
    from: env('MAIL_FROM') || 'Morano Europe <no-reply@moranoeurope.com>',
    sales: env('SALES_EMAIL'),
    alert: env('ALERT_EMAIL'),
  },
  crm: {
    url: env('CRM_WEBHOOK_URL'),
    secret: env('CRM_WEBHOOK_SECRET'),
  },
};

export const stripeConfigured = () =>
  config.stripe.secretKey.startsWith('sk_') && config.stripe.webhookSecret.startsWith('whsec_');

export const smtpConfigured = () => Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);

export const contact = {
  company: 'MORANO EUROPE SL',
  brand: 'Morano Europe',
  address: 'Paseo de la Castellana 200, Madrid, España',
  addressShort: 'Paseo de la Castellana 200, Madrid',
  whatsapp: '+34 691 777 292',
  whatsappDigits: '34691777292',
  instagram: 'moranoeurope',
  instagramUrl: 'https://www.instagram.com/moranoeurope/',
  web: 'www.moranoeurope.com',
  groupUrl: 'https://moranogruppo.com/',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Paseo+de+la+Castellana+200+Madrid',
};
