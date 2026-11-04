import type { APIRoute } from 'astro';
import { config } from '../lib/config.ts';

export const GET: APIRoute = () =>
  new Response(
    `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /es/finalizar-compra
Disallow: /en/checkout
Disallow: /es/pedido/
Disallow: /en/order/

Sitemap: ${config.siteUrl}/sitemap.xml
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } }
  );
