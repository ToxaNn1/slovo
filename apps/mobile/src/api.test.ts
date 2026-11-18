import { ORPCError, type ApiFetch } from '@slovo/contracts/api';
import type { Schedule } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { createDeviceBackend, REQUEST_TIMEOUT } from './api';

/** A schedule whose time moves only when the test says. */
function fakeSchedule() {
  let now = 0;
  let timers: { at: number; run: () => void }[] = [];
  const schedule: Schedule = (run, delay) => {
    const timer = { at: now + delay, run };
    timers.push(timer);
    return () => {
      timers = timers.filter((other) => other !== timer);
    };
  };
  return {
    schedule,
    pending: () => timers.length,
    elapse(ms: number) {
      now += ms;
      const due = timers.filter((timer) => timer.at <= now);
      timers = timers.filter((timer) => timer.at > now);
      for (const timer of due) timer.run();
    },
  };
}

/** A fetch that never answers, and the signals of the requests it was sent. */
function silentFetch() {
  const signals: AbortSignal[] = [];
  const fetch: ApiFetch = (request) => {
    signals.push(request.signal);
    return new Promise<Response>(() => undefined);
  };
  return { fetch, signals };
}

/** Lets the client's own steps before and after its fetch run. */
const flush = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

const requestCode = (backend: ReturnType<typeof createDeviceBackend>) =>
  backend.account.requestCode({ email: 'olena@ukr.net', editionId: 'uk' });

describe('the device backend', () => {
  it('gives up on a request with no answer once the timeout passes', async () => {
    const time = fakeSchedule();
    const { fetch, signals } = silentFetch();
    const backend = createDeviceBackend({ url: 'http://api.test', fetch, schedule: time.schedule });

    let outcome = 'waiting';
    const answer = requestCode(backend).then(
      () => (outcome = 'answered'),
      (error: unknown) => (outcome = error instanceof ORPCError ? 'answered' : 'no answer'),
    );
    await flush();
    time.elapse(REQUEST_TIMEOUT - 1);
    await flush();
    expect(outcome).toBe('waiting');

    time.elapse(1);
    await answer;

    expect(outcome).toBe('no answer');
    expect(signals[0]?.aborted).toBe(true);
  });

  it('passes on an answer that comes in time and stops its timeout', async () => {
    const time = fakeSchedule();
    const fetch: ApiFetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({}), { headers: { 'content-type': 'application/json' } }),
      );
    const backend = createDeviceBackend({ url: 'http://api.test', fetch, schedule: time.schedule });

    await expect(requestCode(backend)).resolves.toBeDefined();
    expect(time.pending()).toBe(0);
  });
});
