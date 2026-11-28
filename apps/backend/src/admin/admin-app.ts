import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type MiddlewareHandler } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

/**
 * The built admin runs only its own module scripts and stylesheets (Vite
 * writes no inline script); its fonts are its own files or `data:` ones, and
 * an Illustration comes from the Media Store's https address. Nothing frames
 * it, and it calls only its own origin's API.
 */
const adminPageHeaders = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    fontSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'none'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  },
  xFrameOptions: 'DENY',
});

/**
 * The headers of an admin API or Sync answer: JSON that no page frames or
 * runs, and that no browser or CDN keeps, since it holds an Admin user's or
 * a reader's own data.
 */
export const privateApiHeaders: MiddlewareHandler[] = [
  secureHeaders({
    contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    xFrameOptions: 'DENY',
  }),
  async (c, next) => {
    await next();
    c.header('cache-control', 'no-store');
  },
];

/**
 * The owner admin app (ADR 0088) at `/admin`: the built apps/admin from
 * `dist`, and its index page for every other address, where its router takes
 * over. The admin API it calls is the API's `/v1/admin`. While no Власник
 * exists, it answers 404.
 */
export function adminApp({ dist, isOn }: { dist: string; isOn: () => Promise<boolean> }) {
  const index = readFileSync(join(dist, 'index.html'), 'utf8');

  return new Hono()
    .use('/*', adminPageHeaders)
    .use('/*', async (c, next) => {
      if (!(await isOn())) return c.notFound();
      return next();
    })
    .use(
      '/*',
      serveStatic({ root: dist, rewriteRequestPath: (path) => path.replace(/^\/admin/, '') }),
    )
    .get('/*', (c) => c.html(index));
}
