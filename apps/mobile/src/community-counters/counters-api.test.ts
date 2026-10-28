import { createApiClient } from '@slovo/contracts/api';
import { serveApi, type ApiProcedures } from '@slovo/contracts/api/test-support';
import { describe, expect, it } from 'vitest';

import { createCountersApi } from './counters-api';

/** The Counters API of the Ukrainian Edition over a backend that serves the contract's `procedures`. */
const countersApiServedBy = (procedures: ApiProcedures) =>
  createCountersApi({
    client: createApiClient({ url: 'http://backend.test', fetch: serveApi(procedures) }),
    editionId: 'uk',
  });

describe('the Counters API over the contract’s client', () => {
  it('reads the counters of several Entries in one request, with no Session', async () => {
    const asked: unknown[] = [];
    const api = countersApiServedBy({
      counters: {
        read: ({ input, context }) => {
          asked.push({ input, session: context.headers.get('authorization') });
          return {
            counters: input.entries.map((entryId, known) => ({
              entryId,
              known,
              unknown: 1,
              saved: 0,
            })),
          };
        },
      },
    });

    await expect(api.read(['w_abc123', 'c_def456'])).resolves.toEqual({
      ok: true,
      counters: [
        { entryId: 'w_abc123', known: 0, unknown: 1, saved: 0 },
        { entryId: 'c_def456', known: 1, unknown: 1, saved: 0 },
      ],
    });
    expect(asked).toEqual([
      { input: { edition: 'uk', entries: ['w_abc123', 'c_def456'] }, session: null },
    ]);
  });

  it('answers a failed request as a failure, never rejecting', async () => {
    const api = countersApiServedBy({
      counters: {
        read: () => {
          throw new Error('The database is down');
        },
      },
    });

    await expect(api.read(['w_abc123'])).resolves.toEqual({ ok: false, reason: 'server-error' });
  });
});
