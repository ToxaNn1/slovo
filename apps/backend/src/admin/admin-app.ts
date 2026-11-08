import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { serveStatic } from '@hono/node-server/serve-static';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { implement } from '@orpc/server';
import { adminApiContract } from '@slovo/contracts/admin-api';
import type { Edition } from '@slovo/server-core';
import { Hono } from 'hono';

/**
 * The owner admin app (ADR 0088) at `/admin`: the admin API of the contracts
 * at `/admin/api`, the built apps/admin from `dist`, and its index page for
 * every other address, where its router takes over.
 */
export function adminApp({ dist, editions }: { dist: string; editions: readonly Edition[] }) {
  const router = implement(adminApiContract).router({
    editions: implement(adminApiContract.editions).handler(() => ({
      editions: editions.map(({ config }) => ({ id: config.id, displayName: config.displayName })),
    })),
  });
  const api = new OpenAPIHandler(router);
  const index = readFileSync(join(dist, 'index.html'), 'utf8');

  return new Hono()
    .use('/api/*', async (c, next) => {
      const { matched, response } = await api.handle(c.req.raw);
      if (matched) return c.newResponse(response.body, response);
      return next();
    })
    .use(
      '/*',
      serveStatic({ root: dist, rewriteRequestPath: (path) => path.replace(/^\/admin/, '') }),
    )
    .get('/*', (c) => (c.req.path.startsWith('/admin/api/') ? c.notFound() : c.html(index)));
}
