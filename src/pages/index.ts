// "/" → /es/ o /en/ según las preferencias de idioma del navegador.
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ request }) => {
  const prefs = (request.headers.get('accept-language') || '')
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) || 0 : 1 };
    })
    .filter((p) => p.lang === 'es' || p.lang === 'en')
    .sort((a, b) => b.q - a.q);
  const target = prefs[0]?.lang === 'es' ? '/es/' : '/en/';
  return new Response(null, { status: 302, headers: { Location: target, Vary: 'Accept-Language', 'Cache-Control': 'no-cache' } });
};
