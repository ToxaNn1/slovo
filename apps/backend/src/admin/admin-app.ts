import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

/**
 * The owner admin app (ADR 0088) at `/admin`: the built apps/admin from
 * `dist`, and its index page for every other address, where its router takes
 * over. The admin API it calls is the API's `/v1/admin`.
 */
export function adminApp({ dist }: { dist: string }) {
  const index = readFileSync(join(dist, 'index.html'), 'utf8');

  return new Hono()
    .use(
      '/*',
      serveStatic({ root: dist, rewriteRequestPath: (path) => path.replace(/^\/admin/, '') }),
    )
    .get('/*', (c) => c.html(index));
}
