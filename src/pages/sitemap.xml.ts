// Sitemap XML con alternativas hreflang por idioma.
import type { APIRoute } from 'astro';
import { config } from '../lib/config.ts';
import { all } from '../lib/db.ts';
import { ROUTES } from '../lib/i18n.ts';

export const GET: APIRoute = async () => {
  const site = config.siteUrl;
  const products = await all<{ slug: string; updated_at: number }>("SELECT slug, updated_at FROM products WHERE status = 'active' ORDER BY sort");
  const pages: { es: string; en: string; lastmod?: number; priority: string }[] = [
    { es: ROUTES.home.es, en: ROUTES.home.en, priority: '1.0', lastmod: Math.max(0, ...products.map((p) => p.updated_at)) },
    ...products.map((p) => ({ es: ROUTES.product.es + p.slug, en: ROUTES.product.en + p.slug, lastmod: p.updated_at, priority: '0.8' })),
    { es: ROUTES.terms.es, en: ROUTES.terms.en, priority: '0.3' },
    { es: ROUTES.legal.es, en: ROUTES.legal.en, priority: '0.2' },
    { es: ROUTES.privacy.es, en: ROUTES.privacy.en, priority: '0.2' },
    { es: ROUTES.cookies.es, en: ROUTES.cookies.en, priority: '0.2' },
  ];
  const urls = pages
    .flatMap((p) =>
      (['es', 'en'] as const).map(
        (l) => `  <url>
    <loc>${site}${p[l]}</loc>${p.lastmod ? `\n    <lastmod>${new Date(p.lastmod).toISOString().slice(0, 10)}</lastmod>` : ''}
    <priority>${p.priority}</priority>
    <xhtml:link rel="alternate" hreflang="es-ES" href="${site}${p.es}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${site}${p.en}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${site}${p.en}"/>
  </url>`
      )
    )
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
