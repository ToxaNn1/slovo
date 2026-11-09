import { describe, expect, it } from 'vitest';
import { createSentryApi } from './sentry-api';

const now = new Date('2026-11-09T12:00:00.000Z');
const window = { from: new Date('2026-11-08T12:00:00.000Z'), to: now };

/** A Sentry API that answers every request with the response, keeping what was asked. */
function sentryAnswering(answer: () => Response) {
  const asked: { signal: AbortSignal | null | undefined }[] = [];
  const sentry = createSentryApi({
    token: 'token',
    org: 'org',
    appProject: '1',
    backendProject: '2',
    clock: { now: () => now },
    fetch: (_, init) => {
      asked.push({ signal: init?.signal });
      return Promise.resolve(answer());
    },
  });
  return { sentry, asked };
}

const json = (body: unknown) => Response.json(body);

describe('the Sentry API', () => {
  it('reads the numbers of each endpoint, a crash-free rate in percent', async () => {
    const { sentry } = sentryAnswering(() => json({ data: [{ 'count()': 7 }] }));
    expect(await sentry.read('errors', window)).toEqual({ ok: true, value: 7 });

    const sessions = sentryAnswering(() =>
      json({ groups: [{ by: {}, totals: { 'crash_free_rate(session)': 0.995 } }] }),
    );
    expect(await sessions.sentry.read('crashFree', window)).toEqual({ ok: true, value: 99.5 });

    const issues = sentryAnswering(() => json([{ count: '12' }, { count: '3' }]));
    expect(await issues.sentry.read('newIssues', window)).toEqual({ ok: true, value: 2 });
    expect(await issues.sentry.read('newIssueEvents', window)).toEqual({ ok: true, value: 12 });
  });

  it.each([
    ['a body that is not JSON', () => new Response('<html>Bad gateway</html>')],
    ['a truncated body', () => new Response('{"data": [')],
    ['a body of another shape', () => json({ data: 'none' })],
    ['an answer of another shape', () => json({ rows: [] })],
  ])('answers unavailable to %s', async (_, answer) => {
    const { sentry } = sentryAnswering(answer);
    for (const read of ['errors', 'crashes', 'newIssues', 'newIssueEvents'] as const) {
      expect(await sentry.read(read, window)).toEqual({ ok: false, reason: 'unavailable' });
    }
  });

  it('gives up on a request that hangs', async () => {
    const { sentry, asked } = sentryAnswering(() => json({ data: [] }));
    await sentry.read('errors', window);
    expect(asked[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('answers rate-limited until the Retry-After of the clock, or a minute on', async () => {
    const limited = sentryAnswering(
      () => new Response(null, { status: 429, headers: { 'retry-after': '30' } }),
    );
    expect(await limited.sentry.read('errors', window)).toEqual({
      ok: false,
      reason: 'rate-limited',
      retryAt: new Date(now.getTime() + 30_000),
    });

    const bare = sentryAnswering(() => new Response(null, { status: 429 }));
    expect(await bare.sentry.read('errors', window)).toEqual({
      ok: false,
      reason: 'rate-limited',
      retryAt: new Date(now.getTime() + 60_000),
    });
  });
});
