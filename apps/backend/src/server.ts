import { createServer } from 'node:http';

import { getRequestListener } from '@hono/node-server';

import type { App } from './app';
import type { Database } from './database/database';

export interface RunningServer {
  /** The port it listens on. */
  readonly port: number;
  /**
   * Stops taking requests, finishes the ones in flight, then closes the
   * database pool. Calling it again waits for the same stop.
   */
  stop(): Promise<void>;
}

/** Serves the app over HTTP on Node. */
export function startServer({
  app,
  database,
  port,
}: {
  app: App;
  database: Database;
  port: number;
}): Promise<RunningServer> {
  let stopping = false;
  const listener = getRequestListener(app.fetch);
  const server = createServer((request, response) => {
    // A connection kept alive would hold a stopping server open until it
    // times out, so each one closes once its answer is sent.
    response.on('finish', () => {
      if (stopping) server.closeIdleConnections();
    });
    // The listener answers every request itself, a failure included.
    void listener(request, response);
  });

  let stopped: Promise<void> | undefined;
  const close = async () => {
    stopping = true;
    await new Promise<void>((closed, failed) => {
      server.close((error) => {
        if (error) failed(error);
        else closed();
      });
    });
    await database.close();
  };
  // A second signal while stopping waits for the same stop.
  const stop = () => (stopped ??= close());

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error(`the server listens on ${String(address)}, not on a TCP port`));
      } else {
        resolve({ port: address.port, stop });
      }
    });
  });
}
