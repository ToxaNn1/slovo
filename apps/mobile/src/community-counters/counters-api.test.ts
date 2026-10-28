import { createApiClient } from '@slovo/contracts/api';
import { serveApi, type ApiProcedures } from '@slovo/contracts/api/test-support';
import { describe, expect, it } from 'vitest';

import { createCountersApi } from './counters-api';

/** The Counters API of the Ukrainian Edition over a backend that serves the contract's `procedures`. */
const countersApiServedBy = (procedures: ApiProcedures) =>
  createCountersApi({
    clientOf: (fetch) => createApiClient({ url: 'http://backend.test', fetch }),
    fetch: serveApi(procedures),
    editionId: 'uk',
  });

/** A backend whose counter events refuse with `code`, setting `Retry-After` when given. */
const refusing = (code: 'TOO_MANY_REQUESTS' | 'NOT_FOUND', retryAfter?: string): ApiProcedures => ({
  counters: {
    send: ({ errors, context }) => {
      if (retryAfter !== undefined) context.resHeaders?.set('retry-after', retryAfter);
      throw errors[code]();
    },
  },
});

const events = [
  { entryId: 'w_abc123', known: 1, unknown: 0, saved: 1 },
  { entryId: 'c_def456', known: -1, unknown: 1, saved: 0 },
] as const;

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

  it('sends the events with the Edition alone, no Session, and the backend counts them', async () => {
    const asked: unknown[] = [];
    const api = countersApiServedBy({
      counters: {
        send: ({ input, context }) => {
          asked.push({ input, session: context.headers.get('authorization') });
        },
      },
    });

    await expect(api.send(events)).resolves.toEqual({ ok: true });
    expect(asked).toEqual([{ input: { editionId: 'uk', events }, session: null }]);
  });

  it('answers too many requests with the seconds of Retry-After', async () => {
    const api = countersApiServedBy(refusing('TOO_MANY_REQUESTS', '3600'));

    await expect(api.send(events)).resolves.toEqual({
      ok: false,
      reason: 'too-many-requests',
      retryAfter: 3600,
    });
  });

  it('answers an Edition the backend doesn’t find, or counters switched off, as not found', async () => {
    const api = countersApiServedBy(refusing('NOT_FOUND'));

    await expect(api.send(events)).resolves.toEqual({ ok: false, reason: 'not-found' });
  });
});
