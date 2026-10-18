import { createApiClient } from '@slovo/contracts/api';
import { failingWith, serveApi, type ApiProcedures } from '@slovo/contracts/api/test-support';
import { describe, expect, it } from 'vitest';

import { createSwitchesApi } from './switches-api';

/** The switches API of the Ukrainian Edition over a backend that serves the contract's `procedures`. */
const switchesApiServedBy = (procedures: ApiProcedures) => switchesApiOver(serveApi(procedures));

/** The switches API of the Ukrainian Edition over whatever `fetch` reaches. */
const switchesApiOver = (fetch: (request: Request) => Promise<Response>) =>
  createSwitchesApi({
    client: createApiClient({ url: 'http://backend.test', fetch }),
    editionId: 'uk',
  });

describe('the switches API over the contract’s client', () => {
  it('asks for the Edition’s remote switches with no Session, and answers them with their ETag', async () => {
    const asked: unknown[] = [];
    const switchesApi = switchesApiServedBy({
      edition: {
        switches: ({ input, context }) => {
          asked.push({
            params: input.params,
            etag: input.headers?.['if-none-match'],
            session: context.headers.get('authorization'),
          });
          return { status: 200, headers: { etag: '"game"' }, body: { off: ['game'] } };
        },
      },
    });

    await expect(switchesApi.switches(undefined)).resolves.toEqual({
      ok: true,
      answer: { off: ['game'], etag: '"game"' },
    });
    expect(asked).toEqual([{ params: { editionId: 'uk' }, etag: undefined, session: null }]);
  });

  it('names the ETag of the switches the app keeps, and answers unchanged on 304', async () => {
    const named: unknown[] = [];
    const switchesApi = switchesApiServedBy({
      edition: {
        switches: ({ input }) => {
          named.push(input.headers?.['if-none-match']);
          return { status: 304, headers: { etag: '"game"' } };
        },
      },
    });

    await expect(switchesApi.switches('"game"')).resolves.toEqual({
      ok: true,
      answer: 'unchanged',
    });
    expect(named).toEqual(['"game"']);
  });

  it.each([
    ['unexpected', 'NOT_FOUND'],
    ['too-many-requests', 'TOO_MANY_REQUESTS'],
    ['unexpected', 'BAD_REQUEST'],
  ] as const)('answers %s when the backend answers %s', async (reason, code) => {
    const switchesApi = switchesApiServedBy(failingWith(code));

    await expect(switchesApi.switches(undefined)).resolves.toEqual({ ok: false, reason });
  });

  it('answers a server error when the backend fails', async () => {
    const switchesApi = switchesApiServedBy({});

    await expect(switchesApi.switches(undefined)).resolves.toEqual({
      ok: false,
      reason: 'server-error',
    });
  });

  it('answers offline when no answer comes', async () => {
    const switchesApi = switchesApiOver(() =>
      Promise.reject(new TypeError('Network request failed')),
    );

    await expect(switchesApi.switches(undefined)).resolves.toEqual({
      ok: false,
      reason: 'offline',
    });
  });
});
