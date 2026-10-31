import { createApiClient, type ApiFetch } from '@slovo/contracts/api';
import {
  answeringWith,
  failingWith,
  refusal,
  serveApi,
  type ApiProcedures,
} from '@slovo/contracts/api/test-support';
import { describe, expect, it } from 'vitest';

import { answerOf } from './backend';
import {
  createMemoryUserStatePort,
  openComposition,
  openMistakeReports,
  openUserState,
  type Backend,
} from './index';
import { createMemoryContentPort } from './testing';
import { fakeClock, randomOf, testEdition, testSchedule, word } from './test-support';

// ADR 0064: the Core reaches the backend through one port, the contract's
// client, and answers, retries and maps every call itself (ADR 0037); its
// tests serve the contract in process (ADR 0064).

/** The Backend port over a backend that serves the contract's `procedures`. */
const backendServedBy = (procedures: ApiProcedures) => backendOver(serveApi(procedures));

/** The Backend port over whatever `fetch` reaches. */
const backendOver = (fetch: ApiFetch): Backend =>
  createApiClient({ url: 'http://backend.test', fetch });

/** No answer at all, as without a network. */
const noAnswer: ApiFetch = () => Promise.reject(new TypeError('Network request failed'));

/** A proxy's answer, which is no answer of the contract. */
const badGateway = answeringWith(502, '<h1>502 Bad Gateway</h1>');

const autumn = { edition: 'uk', name: 'Осінь', entryIds: ['w_kvasha', 'w_buzok'] };

/** The waits of the one retry rule, in milliseconds: the 3 tries again at a draw of 0.5 take 750 + 1500 + 3000. */
const ALL_TRIES = 6_000;

describe('answerOf', () => {
  it('answers the output of a call that succeeds', async () => {
    const backend = backendServedBy({ collectionLinks: { read: () => autumn } });

    await expect(answerOf(backend.collectionLinks.read({ id: 'abc123defg' }))).resolves.toEqual({
      ok: true,
      output: autumn,
    });
  });

  it('sends the Session of a call that names one as a bearer token, and none otherwise', async () => {
    const sessions: (string | null)[] = [];
    const backend = backendServedBy({
      account: {
        me: ({ context }) => {
          sessions.push(context.headers.get('authorization'));
          return { email: 'anna@example.com', createdAt: '2026-10-17T09:00:00.000Z' };
        },
        requestCode: ({ context }) => {
          sessions.push(context.headers.get('authorization'));
          return {};
        },
      },
    });

    await answerOf(backend.account.me(undefined, { context: { token: 'the-token' } }));
    await answerOf(backend.account.requestCode({ email: 'anna@example.com', editionId: 'uk' }));

    expect(sessions).toEqual(['Bearer the-token', null]);
  });

  it('answers an error the contract defines as the failure made of it, typed by its code and data', async () => {
    const backend = backendServedBy({
      account: {
        verifyCode: ({ errors }) => {
          throw errors.WRONG_CODE({ data: { triesLeft: 3 } });
        },
      },
    });

    const answer = await answerOf(
      backend.account.verifyCode({ email: 'anna@example.com', code: '123456' }),
      (error) =>
        error.code === 'WRONG_CODE'
          ? ({ ok: false, reason: 'wrong-code', triesLeft: error.data.triesLeft } as const)
          : undefined,
    );

    expect(answer).toEqual({ ok: false, reason: 'wrong-code', triesLeft: 3 });
  });

  it('answers offline when no answer comes', async () => {
    const backend = backendOver(noAnswer);

    await expect(answerOf(backend.collectionLinks.read({ id: 'abc123defg' }))).resolves.toEqual({
      ok: false,
      reason: 'offline',
    });
  });

  it.each([
    ['the backend fails', backendServedBy({})],
    ['a proxy answers 502', backendOver(badGateway)],
  ])('answers a server error when %s', async (_when, backend) => {
    await expect(answerOf(backend.collectionLinks.read({ id: 'abc123defg' }))).resolves.toEqual({
      ok: false,
      reason: 'server-error',
    });
  });

  it('answers too many requests with the seconds of the answer’s Retry-After', async () => {
    const backend = backendServedBy({
      reports: {
        send: ({ errors, context }) => {
          context.resHeaders?.set('retry-after', '3600');
          throw errors.TOO_MANY_REQUESTS();
        },
      },
    });

    await expect(answerOf(backend.reports.send(report))).resolves.toEqual({
      ok: false,
      reason: 'too-many-requests',
      retryAfter: 3600,
    });
  });

  it.each([undefined, 'soon', '-5', ''])(
    'answers too many requests with no Retry-After when the answer says %j',
    async (retryAfter) => {
      const backend = backendServedBy({
        reports: {
          send: ({ errors, context }) => {
            if (retryAfter !== undefined) context.resHeaders?.set('retry-after', retryAfter);
            throw errors.TOO_MANY_REQUESTS();
          },
        },
      });

      await expect(answerOf(backend.reports.send(report))).resolves.toEqual({
        ok: false,
        reason: 'too-many-requests',
        retryAfter: undefined,
      });
    },
  );

  it.each(['BAD_REQUEST', 'NOT_FOUND', 'UNAUTHORIZED'] as const)(
    'answers unexpected when the backend answers %s and the call expects no such thing',
    async (code) => {
      const backend = backendServedBy(failingWith(code));

      await expect(answerOf(backend.collectionLinks.read({ id: 'abc123defg' }))).resolves.toEqual({
        ok: false,
        reason: 'unexpected',
      });
    },
  );
});

const report = {
  editionId: 'uk',
  entryId: 'w_kvasha',
  type: 'stress',
  comment: 'Наголос на другому складі.',
  appVersion: '0.8.14',
  contentVersion: 42,
} as const;

const content = createMemoryContentPort({
  words: [word('w_kvasha'), word('w_buzok'), word('w_old')],
});

/** A procedure over its limit: 429 with a `Retry-After` of an hour. */
const limited = ({
  context,
}: {
  readonly context: NonNullable<Parameters<typeof refusal>[1]>;
}): never => {
  throw refusal('TOO_MANY_REQUESTS', context, { retryAfter: 3600 });
};

/** A backend whose procedures these features call all answer over their limit. */
const overLimit: ApiProcedures = {
  collectionLinks: { create: limited, read: limited },
  counters: { communityWord: limited },
  reports: { send: limited },
};

/** The ways a backend fails that every feature meets: no answer, a limit, and a server error. */
const failing = {
  offline: () => backendOver(noAnswer),
  'too-many-requests': () => backendServedBy(overLimit),
  'server-error': () => backendServedBy({}),
} as const;

/** The Core composition of the UA Edition over `backend`, with Collection Links and the Community Word on. */
async function composition(backend: Backend, at = '2026-10-26T09:00:00+03:00') {
  const time = fakeClock(at);
  const timers = testSchedule(time);
  const app = await openComposition({
    content,
    edition: testEdition({
      id: 'uk',
      userSettingDefaults: {
        mix: { corrections: false, idioms: false, synonymRows: false, tips: false },
      },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort() }),
    clock: time.clock,
    random: randomOf(0.5),
    schedule: timers.schedule,
    backend,
  });
  return { app, time, timers };
}

describe('the composition over a backend that fails', () => {
  describe('sharing a Collection', () => {
    it.each([
      ['offline', 'offline'],
      ['too-many-requests', 'too-many-requests'],
      ['server-error', 'failed'],
    ] as const)('says why when the backend is %s: %s', async (failure, reason) => {
      const { app, timers } = await composition(failing[failure]());
      const created = await app.collections.create('Осінь');
      if (!created.ok) throw new Error('The Collection was refused');
      await app.collections.add(created.collection.id, 'w_kvasha');

      const shared = app.collectionSharing.share(created.collection.id, {
        message: 'Колекція «{name}» у SLOVO: {url}',
      });
      await timers.advance(ALL_TRIES);

      expect(await shared).toEqual({ ok: false, reason });
    });
  });

  describe('opening a Collection Link', () => {
    it.each(['offline', 'too-many-requests', 'server-error'] as const)(
      'says there is no connection when the backend is %s',
      async (failure) => {
        const { app, timers } = await composition(failing[failure]());

        const preview = app.collectionLinkCopy.preview('abc123defg');
        await timers.advance(ALL_TRIES);

        expect(await preview).toEqual({ ok: false, reason: 'offline' });
      },
    );
  });

  describe('the Community Word', () => {
    it.each(['offline', 'too-many-requests', 'server-error'] as const)(
      'is not there on a Monday when the backend is %s, and the Feed goes on',
      async (failure) => {
        const { app } = await composition(failing[failure]());

        while (app.feed.cards.length < 3 && (await app.feed.next()) !== undefined);

        expect(app.feed.cards.length).toBeGreaterThan(0);
        expect(app.feed.cards.some((card) => card.kind === 'notice')).toBe(false);
      },
    );
  });
});

describe('Mistake Reports over a backend that fails', () => {
  async function reports(backend: Backend) {
    const time = fakeClock('2026-10-28T09:00:00.000Z');
    const timers = testSchedule(time);
    const userState = await openUserState({ port: createMemoryUserStatePort() });
    const opened = openMistakeReports({
      userState,
      backend,
      edition: { id: 'uk', isFeatureEnabled: () => true },
      appVersion: '0.8.14',
      contentVersion: 42,
      clock: time.clock,
      schedule: timers.schedule,
      random: randomOf(0.5),
    });
    return {
      async report() {
        const answer = opened.report({ entryId: 'w_kvasha', type: 'stress', comment: 'Наголос' });
        await timers.advance(ALL_TRIES);
        return answer;
      },
    };
  }

  // A report the backend didn't take for a reason that may pass is thanked and waits in the queue.
  it.each([
    ['offline', 'thanked'],
    ['server-error', 'thanked'],
    ['too-many-requests', 'too-many-requests'],
  ] as const)('answers the sheet when the backend is %s: %s', async (failure, answer) => {
    const app = await reports(failing[failure]());

    expect(await app.report()).toBe(answer);
  });
});
