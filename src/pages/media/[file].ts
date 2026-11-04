// GET /media/<id>-<ancho>.webp — imágenes subidas desde el panel (re-codificadas).
import type { APIRoute } from 'astro';
import { readMedia } from '../../lib/media.ts';

export const GET: APIRoute = async ({ params }) => {
  const m = /^([A-Za-z0-9]{16})-(\d{3,4})\.webp$/.exec(params.file || '');
  if (!m) return new Response('Not found', { status: 404 });
  const row = await readMedia(m[1], Number(m[2]));
  if (!row) return new Response('Not found', { status: 404 });
  return new Response(row.data as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
