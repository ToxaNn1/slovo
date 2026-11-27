import { describe, expect, it } from 'vitest';

import { createApiClient, TooManyRequestsError } from '../api';
import { answeringWith, refusal, serveApi } from './test-support';

/** A Mistake Report as the app sends it. */
const REPORT = {
  editionId: 'uk',
  entryId: 'w_abc123',
  type: 'stress',
  comment: 'Наголос на другому складі.',
  appVersion: '0.8.14',
  contentVersion: 42,
} as const;

/** A backend that takes every report, and the headers of each request it got. */
function backend() {
  const seen: Headers[] = [];
  const serve = serveApi({ reports: { send: () => undefined } });
  const fetch = (request: Request) => {
    seen.push(request.headers);
    return serve(request);
  };
  return { fetch, seen };
}

/** What sending a report throws, through a client over `fetch`. */
async function refusalOf(fetch: (request: Request) => Promise<Response>): Promise<unknown> {
  const api = createApiClient({ url: 'http://backend.test', fetch });
  return api.reports.send(REPORT).then(
    () => undefined,
    (error: unknown) => error,
  );
}

/** A `fetch` that answers every request with a 429 and the headers, as a proxy may. */
const busyWith = (headers: Record<string, string>) => (): Promise<Response> =>
  Promise.resolve(new Response('busy', { status: 429, headers }));

describe('a client of the API', () => {
  it('sends a call with no Session with only its own headers', async () => {
    const { fetch, seen } = backend();
    const api = createApiClient({ url: 'http://backend.test', fetch, headers: { 'x-test': 'a' } });

    await api.reports.send(REPORT);

    expect(seen[0]?.get('x-test')).toBe('a');
    expect(seen[0]?.has('authorization')).toBe(false);
  });

  it('sends the Session of a call as a bearer token, beside its own headers', async () => {
    const { fetch, seen } = backend();
    const api = createApiClient({ url: 'http://backend.test', fetch, headers: { 'x-test': 'a' } });

    await api.reports.send(REPORT, { context: { token: 'session-1' } });

    expect(seen[0]?.get('authorization')).toBe('Bearer session-1');
    expect(seen[0]?.get('x-test')).toBe('a');
  });

  it("throws the contract's TOO_MANY_REQUESTS on a 429, with the seconds of its Retry-After", async () => {
    const serve = serveApi({
      reports: {
        send: ({ context }) => {
          throw refusal('TOO_MANY_REQUESTS', context, { retryAfter: 30 });
        },
      },
    });

    const error = await refusalOf(serve);

    expect(error).toBeInstanceOf(TooManyRequestsError);
    expect(error).toMatchObject({ code: 'TOO_MANY_REQUESTS', status: 429, defined: true });
    expect(error).toHaveProperty('retryAfter', 30);
  });

  it("throws a contract's other 429 code as it is, such as a spent Sign-in code", async () => {
    const serve = serveApi({
      account: {
        verifyCode: () => {
          throw refusal('CODE_SPENT');
        },
      },
    });
    const api = createApiClient({ url: 'http://backend.test', fetch: serve });

    const error = await api.account.verifyCode({ email: 'anna@mail.com', code: '100001' }).then(
      () => undefined,
      (refused: unknown) => refused,
    );

    expect(error).not.toBeInstanceOf(TooManyRequestsError);
    expect(error).toMatchObject({ code: 'CODE_SPENT', status: 429, defined: true });
  });

  it('throws TOO_MANY_REQUESTS on a 429 that is no answer of the contract, as a proxy gives', async () => {
    const error = await refusalOf(answeringWith(429, '<html>busy</html>'));

    expect(error).toBeInstanceOf(TooManyRequestsError);
    expect(error).toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      status: 429,
      defined: false,
      message: 'Too many requests',
      data: undefined,
      retryAfter: undefined,
    });
  });

  it('reads the seconds of a Retry-After a proxy sets', async () => {
    expect(await refusalOf(busyWith({ 'retry-after': '120' }))).toHaveProperty('retryAfter', 120);
  });

  it('reads no seconds from a Retry-After that says anything else, such as a date', async () => {
    for (const header of ['Wed, 21 Oct 2026 07:28:00 GMT', '120s', '1.5']) {
      const error = await refusalOf(busyWith({ 'retry-after': header }));

      expect(error).toHaveProperty('retryAfter', undefined);
    }
  });

  it('throws no TOO_MANY_REQUESTS on another refusal', async () => {
    const error = await refusalOf(answeringWith(503, 'down'));

    expect(error).not.toBeInstanceOf(TooManyRequestsError);
    expect(error).toMatchObject({ status: 503 });
  });
});
