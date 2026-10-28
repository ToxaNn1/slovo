import { createApiClient } from '@slovo/contracts/api';
import { serveApi, type ApiProcedures } from '@slovo/contracts/api/test-support';
import type { MistakeReport } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { createReportsApi } from './reports-api';

/** The Reports API over a backend that serves the contract's `procedures`. */
const reportsApiServedBy = (procedures: ApiProcedures) =>
  createReportsApi({
    clientOf: (fetch) => createApiClient({ url: 'http://backend.test', fetch }),
    fetch: serveApi(procedures),
  });

const report: MistakeReport = {
  editionId: 'uk',
  entryId: 'w_abc123',
  type: 'stress',
  comment: 'Наголос на другому складі.',
  appVersion: '0.8.14',
  contentVersion: 42,
};

/** A backend whose reports refuse with `code`, setting `Retry-After` when given. */
const refusing = (code: 'TOO_MANY_REQUESTS' | 'NOT_FOUND', retryAfter?: string): ApiProcedures => ({
  reports: {
    send: ({ errors, context }) => {
      if (retryAfter !== undefined) context.resHeaders?.set('retry-after', retryAfter);
      throw errors[code]();
    },
  },
});

describe('the Reports API over the contract’s client', () => {
  it('sends the report with no Session, and the backend takes it', async () => {
    const asked: unknown[] = [];
    const api = reportsApiServedBy({
      reports: {
        send: ({ input, context }) => {
          asked.push({ input, session: context.headers.get('authorization') });
        },
      },
    });

    await expect(api.send(report)).resolves.toEqual({ ok: true });
    expect(asked).toEqual([{ input: report, session: null }]);
  });

  it('answers too many requests with the answer’s Retry-After', async () => {
    const api = reportsApiServedBy(refusing('TOO_MANY_REQUESTS', '3600'));

    await expect(api.send(report)).resolves.toEqual({
      ok: false,
      reason: 'too-many-requests',
      retryAfter: 3600,
    });
  });

  it('answers not found for an Edition with Mistake Reports off', async () => {
    const api = reportsApiServedBy(refusing('NOT_FOUND'));

    await expect(api.send(report)).resolves.toEqual({ ok: false, reason: 'not-found' });
  });

  it('answers offline when no answer comes', async () => {
    const api = createReportsApi({
      clientOf: (fetch) => createApiClient({ url: 'http://backend.test', fetch }),
      fetch: () => Promise.reject(new TypeError('Network request failed')),
    });

    await expect(api.send(report)).resolves.toEqual({ ok: false, reason: 'offline' });
  });
});
