import { createApiClient } from '@slovo/contracts/api';
import type { AccountApi } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { createAccountApi } from './account-api';

interface SentRequest {
  readonly method: string;
  readonly path: string;
  readonly authorization: string | null;
  readonly body: unknown;
}

/** The Account API of the Ukrainian Edition over a backend that answers each request with `answer`. */
function accountApiAnswering(answer: (request: Request) => Promise<Response>) {
  const requests: SentRequest[] = [];
  const clientWith = (headers: Record<string, string>) =>
    createApiClient({
      url: 'http://backend.test',
      headers,
      fetch: async (request) => {
        const text = await request.clone().text();
        requests.push({
          method: request.method,
          path: new URL(request.url).pathname,
          authorization: request.headers.get('authorization'),
          body: text === '' ? undefined : (JSON.parse(text) as unknown),
        });
        return answer(request);
      },
    });
  const accountApi = createAccountApi({
    client: clientWith({}),
    clientOf: (token) => clientWith({ authorization: `Bearer ${token}` }),
    editionId: 'uk',
  });
  return { accountApi, requests };
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );

/** The answer of the backend to a failure it reports with its code and status. */
const failure = (code: string, status: number, data?: unknown) =>
  json({ defined: true, code, status, message: code, data }, status);

/** Every call of the Account API, each with what it needs. */
const calls: Record<keyof AccountApi, (api: AccountApi) => Promise<unknown>> = {
  requestCode: (api) => api.requestCode('anna@example.com'),
  verifyCode: (api) => api.verifyCode('anna@example.com', '123456'),
  me: (api) => api.me('the-token'),
  signOut: (api) => api.signOut('the-token'),
  signOutEverywhere: (api) => api.signOutEverywhere('the-token'),
  delete: (api) => api.delete('the-token'),
};

const everyCall = Object.keys(calls) as (keyof AccountApi)[];

/** The calls that act on an Account, with its Session. */
const signedInCalls = ['me', 'signOut', 'signOutEverywhere', 'delete'] as const;

describe('the Account API over the contract’s client', () => {
  it('asks for a Sign-in code in the Edition’s language, with no Session', async () => {
    const { accountApi, requests } = accountApiAnswering(() => json({}));

    await expect(accountApi.requestCode('anna@example.com')).resolves.toEqual({ ok: true });
    expect(requests).toEqual([
      {
        method: 'POST',
        path: '/v1/account/sign-in-codes',
        authorization: null,
        body: { email: 'anna@example.com', editionId: 'uk' },
      },
    ]);
  });

  it('signs in with the code and answers the new Session’s token and the Account’s email', async () => {
    const { accountApi, requests } = accountApiAnswering(() =>
      json({ token: 'the-token', email: 'anna@example.com' }),
    );

    await expect(accountApi.verifyCode('anna@example.com', '123456')).resolves.toEqual({
      ok: true,
      token: 'the-token',
      email: 'anna@example.com',
    });
    expect(requests).toEqual([
      {
        method: 'POST',
        path: '/v1/account/sessions',
        authorization: null,
        body: { email: 'anna@example.com', code: '123456' },
      },
    ]);
  });

  it('answers the email of the Session’s Account, sending the Session as a bearer token', async () => {
    const { accountApi, requests } = accountApiAnswering(() =>
      json({ email: 'anna@example.com', createdAt: '2026-10-17T09:00:00.000Z' }),
    );

    await expect(accountApi.me('the-token')).resolves.toEqual({
      ok: true,
      email: 'anna@example.com',
    });
    expect(requests).toEqual([
      { method: 'GET', path: '/v1/account/me', authorization: 'Bearer the-token', body: undefined },
    ]);
  });

  it.each([
    ['signOut', '/v1/account/sessions/current'],
    ['signOutEverywhere', '/v1/account/sessions'],
    ['delete', '/v1/account/me'],
  ] as const)('%s ends Sessions with the Session as a bearer token', async (call, path) => {
    const { accountApi, requests } = accountApiAnswering(() => json({}));

    await expect(calls[call](accountApi)).resolves.toEqual({ ok: true });
    expect(requests).toMatchObject([{ method: 'DELETE', path, authorization: 'Bearer the-token' }]);
  });

  it('answers a wrong code with the tries it has left', async () => {
    const { accountApi } = accountApiAnswering(() => failure('WRONG_CODE', 400, { triesLeft: 3 }));

    await expect(accountApi.verifyCode('anna@example.com', '123456')).resolves.toEqual({
      ok: false,
      reason: 'wrong-code',
      triesLeft: 3,
    });
  });

  it('answers an expired code', async () => {
    const { accountApi } = accountApiAnswering(() => failure('CODE_EXPIRED', 400));

    await expect(accountApi.verifyCode('anna@example.com', '123456')).resolves.toEqual({
      ok: false,
      reason: 'code-expired',
    });
  });

  it.each(['requestCode', 'verifyCode'] as const)(
    '%s answers too many requests over a limit',
    async (call) => {
      const { accountApi } = accountApiAnswering(() => failure('TOO_MANY_REQUESTS', 429));

      await expect(calls[call](accountApi)).resolves.toEqual({
        ok: false,
        reason: 'too-many-requests',
      });
    },
  );

  it.each(signedInCalls)('%s answers unauthorized when the Session has ended', async (call) => {
    const { accountApi } = accountApiAnswering(() => failure('UNAUTHORIZED', 401));

    await expect(calls[call](accountApi)).resolves.toEqual({ ok: false, reason: 'unauthorized' });
  });

  it.each(
    everyCall.flatMap((call) => [
      [call, 'INTERNAL', 500] as const,
      [call, 'BAD_GATEWAY', 502] as const,
    ]),
  )('%s answers a server error when the backend answers %s', async (call, code, status) => {
    const { accountApi } = accountApiAnswering(() => failure(code, status));

    await expect(calls[call](accountApi)).resolves.toEqual({ ok: false, reason: 'server-error' });
  });

  it.each(everyCall)('%s answers offline when no answer comes', async (call) => {
    const { accountApi } = accountApiAnswering(() =>
      Promise.reject(new TypeError('Network request failed')),
    );

    await expect(calls[call](accountApi)).resolves.toEqual({ ok: false, reason: 'offline' });
  });

  it('rejects an answer no retry can change, such as an Edition the backend doesn’t serve', async () => {
    const { accountApi } = accountApiAnswering(() => failure('NOT_FOUND', 404));

    await expect(accountApi.requestCode('anna@example.com')).rejects.toMatchObject({
      status: 404,
    });
  });
});
