import { getResponse } from 'msw';
import type { Plugin } from 'vite';

import { mockHandlers } from './handlers';

/**
 * `pnpm dev:admin --mock`: Vite answers the admin API itself from the MSW
 * handlers, so no backend, database or Docker is needed.
 */
export function mockAdminApi(): Plugin {
  const handlers = mockHandlers();
  return {
    name: 'slovo-admin-mock-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/v1/admin/') !== true) {
          next();
          return;
        }
        const request = new Request(new URL(req.url, `http://${req.headers.host ?? 'localhost'}`), {
          method: req.method ?? 'GET',
        });
        void getResponse(handlers, request).then(async (response) => {
          const answer = response ?? Response.json({ code: 'NOT_FOUND' }, { status: 404 });
          res.statusCode = answer.status;
          answer.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await answer.arrayBuffer()));
        }, next);
      });
    },
  };
}
