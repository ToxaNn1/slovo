import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

import { siteWords } from '../site-words';

/**
 * The sitemap Search Console reads (ADR 0147): the landing, every Edition's
 * legal pages and every live Word's page (ADR 0148).
 */
export const GET: APIRoute = async ({ site }) => {
  const legal = await getCollection('legal');
  const { slugs } = await siteWords();
  const paths = [
    '/',
    ...legal.map((entry) => `/${entry.id}`),
    ...[...slugs.values()].map((slug) => `/slovo/${slug}`),
  ];
  const urls = paths.map((path) => `  <url><loc>${new URL(path, site).href}</loc></url>`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
