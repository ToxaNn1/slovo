import { describe, expect, it } from 'vitest';

import { createApiClient } from '../api';
import { serveApi } from './test-support';

/** A Mistake Report as the app sends it. */
const REPORT = {
  editionId: 'uk',
  entryId: 'w_abc123',
  type: 'stress',
  comment: 'Наголос на другому складі.',
  appVersion: '0.8.14',
  contentVersion: 42,
} as const;

/** A backend that keeps what each report it accepts brought. */
function backend() {
  const received: unknown[] = [];
  const serve = serveApi({
    reports: {
      send: ({ input }) => {
        received.push(input);
      },
    },
  });
  /** Sends `body` as JSON to `POST /v1/reports`, as any client may. */
  const post = (body: object) =>
    serve(
      new Request('http://backend.test/v1/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  const api = createApiClient({ url: 'http://backend.test', fetch: serve });
  return { api, post, received };
}

describe('POST /v1/reports', () => {
  it('takes a valid Mistake Report with 202 and no body', async () => {
    const { post, received } = backend();

    const response = await post(REPORT);

    expect(response.status).toBe(202);
    expect(await response.text()).toBe('');
    expect(received).toEqual([REPORT]);
  });

  it('passes the backend the comment trimmed', async () => {
    const { api, received } = backend();

    await api.reports.send({ ...REPORT, comment: '  Наголос на другому складі.\n' });

    expect(received).toEqual([REPORT]);
  });

  it('takes an Entry of each kind with an empty comment', async () => {
    const { api, received } = backend();
    const entryIds = ['w_a1', 'c_a1', 'i_a1', 'r_a1', 't_a1'];

    for (const entryId of entryIds) {
      await api.reports.send({ ...REPORT, entryId, type: 'typo', comment: '' });
    }

    expect(received).toEqual(
      entryIds.map((entryId) => ({ ...REPORT, entryId, type: 'typo', comment: '' })),
    );
  });

  it('takes a comment of 500 characters and «other» with a comment', async () => {
    const { api, received } = backend();
    const comment = 'а'.repeat(500);

    await api.reports.send({ ...REPORT, type: 'other', comment });

    expect(received).toEqual([{ ...REPORT, type: 'other', comment }]);
  });

  it.each([
    ['a comment of 501 characters', { comment: 'а'.repeat(501) }],
    ['«other» with no comment', { type: 'other', comment: '' }],
    ['«other» with a comment of spaces only', { type: 'other', comment: '   ' }],
    ['an unknown type', { type: 'grammar' }],
    ['an id that names no Entry', { entryId: 'x_a1' }],
    ['an Edition id that is no id', { editionId: 'UK' }],
    ['a content version of 0', { contentVersion: 0 }],
    ['an app version that is no version', { appVersion: 'latest' }],
    ['an Account', { accountId: 'a_1' }],
  ])('refuses %s with 400 BAD_REQUEST', async (_case, change) => {
    const { post, received } = backend();

    const response = await post({ ...REPORT, ...change });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'BAD_REQUEST' });
    expect(received).toEqual([]);
  });

  it('refuses a report with no comment field', async () => {
    const { post } = backend();
    const { comment: _comment, ...withoutComment } = REPORT;

    const response = await post(withoutComment);

    expect(response.status).toBe(400);
  });
});
