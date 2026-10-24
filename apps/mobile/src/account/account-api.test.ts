import { createApiClient } from '@slovo/contracts/api';
import { failingWith, serveApi, type ApiProcedures } from '@slovo/contracts/api/test-support';
import type { AccountApi } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { createAccountApi } from './account-api';

/** The Account API of the Ukrainian Edition over a backend that serves the contract's `procedures`. */
const accountApiServedBy = (procedures: ApiProcedures) => accountApiOver(serveApi(procedures));

/** The Account API of the Ukrainian Edition over whatever `fetch` reaches. */
function accountApiOver(fetch: (request: Request) => Promise<Response>) {
  const clientWith = (headers: Record<string, string>) =>
    createApiClient({ url: 'http://backend.test', headers, fetch });
  return createAccountApi({
    client: clientWith({}),
    clientOf: (token) => clientWith({ authorization: `Bearer ${token}` }),
    editionId: 'uk',
  });
}

/** Every call of the Account API, each with what it needs; each calls the procedure of its name. */
const calls: Record<keyof AccountApi, (api: AccountApi) => Promise<unknown>> = {
  requestCode: (api) => api.requestCode('anna@example.com'),
  verifyCode: (api) => api.verifyCode('anna@example.com', '123456'),
  signInWithGoogle: (api) => api.signInWithGoogle('the-google-token'),
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
    const asked: unknown[] = [];
    const accountApi = accountApiServedBy({
      account: {
        requestCode: ({ input, context }) => {
          asked.push({ input, session: context.headers.get('authorization') });
          return {};
        },
      },
    });

    await expect(accountApi.requestCode('anna@example.com')).resolves.toEqual({ ok: true });
    expect(asked).toEqual([
      { input: { email: 'anna@example.com', editionId: 'uk' }, session: null },
    ]);
  });

  it('signs in with the code and answers the new Session’s token and the Account’s email', async () => {
    const asked: unknown[] = [];
    const accountApi = accountApiServedBy({
      account: {
        verifyCode: ({ input, context }) => {
          asked.push({ input, session: context.headers.get('authorization') });
          return { token: 'the-token', email: 'anna@example.com' };
        },
      },
    });

    await expect(accountApi.verifyCode('anna@example.com', '123456')).resolves.toEqual({
      ok: true,
      token: 'the-token',
      email: 'anna@example.com',
    });
    expect(asked).toEqual([
      { input: { email: 'anna@example.com', code: '123456' }, session: null },
    ]);
  });

  it('signs in with a Google identity token for the Edition, and answers the new Session’s token and the Account’s email', async () => {
    const asked: unknown[] = [];
    const accountApi = accountApiServedBy({
      account: {
        signInWithGoogle: ({ input, context }) => {
          asked.push({ input, session: context.headers.get('authorization') });
          return { token: 'the-token', email: 'anna@example.com' };
        },
      },
    });

    await expect(accountApi.signInWithGoogle('the-google-token')).resolves.toEqual({
      ok: true,
      token: 'the-token',
      email: 'anna@example.com',
    });
    expect(asked).toEqual([
      { input: { idToken: 'the-google-token', editionId: 'uk' }, session: null },
    ]);
  });

  it.each(['INVALID_TOKEN', 'FOREIGN_AUDIENCE', 'EMAIL_NOT_VERIFIED'] as const)(
    'answers a Google sign-in the backend refuses as %s refused',
    async (code) => {
      const accountApi = accountApiServedBy({
        account: {
          signInWithGoogle: ({ errors }) => {
            throw errors[code]();
          },
        },
      });

      await expect(accountApi.signInWithGoogle('the-google-token')).resolves.toEqual({
        ok: false,
        reason: 'refused',
      });
    },
  );

  it('answers the email of the Session’s Account, sending the Session as a bearer token', async () => {
    const sessions: (string | null)[] = [];
    const accountApi = accountApiServedBy({
      account: {
        me: ({ context }) => {
          sessions.push(context.headers.get('authorization'));
          return { email: 'anna@example.com', createdAt: '2026-10-17T09:00:00.000Z' };
        },
      },
    });

    await expect(accountApi.me('the-token')).resolves.toEqual({
      ok: true,
      email: 'anna@example.com',
    });
    expect(sessions).toEqual(['Bearer the-token']);
  });

  it.each(['signOut', 'signOutEverywhere', 'delete'] as const)(
    '%s ends Sessions with the Session as a bearer token',
    async (call) => {
      const sessions: (string | null)[] = [];
      const ending: NonNullable<ApiProcedures['account']>[typeof call] = ({ context }) => {
        sessions.push(context.headers.get('authorization'));
        return {};
      };
      const accountApi = accountApiServedBy({ account: { [call]: ending } });

      await expect(calls[call](accountApi)).resolves.toEqual({ ok: true });
      expect(sessions).toEqual(['Bearer the-token']);
    },
  );

  it('answers a wrong code with the tries it has left', async () => {
    const accountApi = accountApiServedBy({
      account: {
        verifyCode: ({ errors }) => {
          throw errors.WRONG_CODE({ data: { triesLeft: 3 } });
        },
      },
    });

    await expect(accountApi.verifyCode('anna@example.com', '123456')).resolves.toEqual({
      ok: false,
      reason: 'wrong-code',
      triesLeft: 3,
    });
  });

  it('answers an expired code', async () => {
    const accountApi = accountApiServedBy({
      account: {
        verifyCode: ({ errors }) => {
          throw errors.CODE_EXPIRED();
        },
      },
    });

    await expect(accountApi.verifyCode('anna@example.com', '123456')).resolves.toEqual({
      ok: false,
      reason: 'code-expired',
    });
  });

  it.each(['requestCode', 'verifyCode', 'signInWithGoogle'] as const)(
    '%s answers too many requests over a limit',
    async (call) => {
      const accountApi = accountApiServedBy(failingWith('TOO_MANY_REQUESTS'));

      await expect(calls[call](accountApi)).resolves.toEqual({
        ok: false,
        reason: 'too-many-requests',
      });
    },
  );

  it.each(signedInCalls)('%s answers unauthorized when the Session has ended', async (call) => {
    const accountApi = accountApiServedBy(failingWith('UNAUTHORIZED'));

    await expect(calls[call](accountApi)).resolves.toEqual({ ok: false, reason: 'unauthorized' });
  });

  it.each(everyCall)('%s answers a server error when the backend fails', async (call) => {
    const accountApi = accountApiServedBy({});

    await expect(calls[call](accountApi)).resolves.toEqual({ ok: false, reason: 'server-error' });
  });

  it.each(everyCall)('%s answers a server error when a proxy answers 502', async (call) => {
    const accountApi = accountApiOver(() =>
      Promise.resolve(new Response('<h1>502 Bad Gateway</h1>', { status: 502 })),
    );

    await expect(calls[call](accountApi)).resolves.toEqual({ ok: false, reason: 'server-error' });
  });

  it.each(everyCall)('%s answers offline when no answer comes', async (call) => {
    const accountApi = accountApiOver(() =>
      Promise.reject(new TypeError('Network request failed')),
    );

    await expect(calls[call](accountApi)).resolves.toEqual({ ok: false, reason: 'offline' });
  });

  it.each(
    everyCall.flatMap((call) => [[call, 'BAD_REQUEST'] as const, [call, 'NOT_FOUND'] as const]),
  )('%s answers unexpected when the backend answers %s', async (call, code) => {
    const accountApi = accountApiServedBy(failingWith(code));

    await expect(calls[call](accountApi)).resolves.toEqual({ ok: false, reason: 'unexpected' });
  });

  it('answers unexpected for a Session ended on a call that carries none', async () => {
    const accountApi = accountApiServedBy(failingWith('UNAUTHORIZED'));

    await expect(accountApi.requestCode('anna@example.com')).resolves.toEqual({
      ok: false,
      reason: 'unexpected',
    });
  });
});
