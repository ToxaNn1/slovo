import type { FeatureSwitch } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  MISTAKE_REPORT_QUEUE_SIZE,
  openMistakeReports,
  openUserState,
  type MistakeReportDraft,
} from '../index';
import { createFakeReportsApi } from '../testing';
import { fakeClock, randomOf, settle, testSchedule } from '../test-support';

const HOUR = 60 * 60_000;

/** Long enough for every wait between the tries of one request (ADR 0037). */
const ALL_TRIES = 10_000;

const typo: MistakeReportDraft = { entryId: 'w_kvasha', type: 'typo', comment: '' };

/** A draft of a typo in the Word `w_<id>`. */
const typoIn = (id: string): MistakeReportDraft => ({ ...typo, entryId: `w_${id}` });

/**
 * The app of the Ukrainian Edition at 0.8.14 with pack 42, over a fake
 * backend, with `mistakeReports` on unless the test turns it off. `relaunch`
 * opens the app again over the same device.
 */
async function device({ off = [] }: { off?: FeatureSwitch[] } = {}) {
  const time = fakeClock('2026-10-28T09:00:00.000Z');
  const timers = testSchedule(time);
  const api = createFakeReportsApi();
  const records = new Map<string, string>();
  const switchedOff = new Set<FeatureSwitch>(off);

  async function launch() {
    return openMistakeReports({
      userState: await openUserState({ port: createMemoryUserStatePort(records) }),
      api,
      edition: { id: 'uk', isFeatureEnabled: (feature) => !switchedOff.has(feature) },
      appVersion: '0.8.14',
      contentVersion: 42,
      clock: time.clock,
      schedule: timers.schedule,
      random: randomOf(0.5),
    });
  }

  const reports = await launch();
  return {
    reports,
    api,
    time,
    switchedOff,
    relaunch: launch,
    advance: timers.advance,
    /** Reports and lets every try and wait of it run. */
    async report(draft: MistakeReportDraft = typo, mistakeReports = reports) {
      const answer = mistakeReports.report(draft);
      await timers.advance(ALL_TRIES);
      return answer;
    },
    /** The ids of the Entries of the reports the backend took, in order. */
    received: () => api.received.map(({ entryId }) => entryId),
  };
}

describe('reporting a mistake online', () => {
  it('sends the Edition, the Entry, the type, the trimmed comment, the app version and the content version, and thanks', async () => {
    const app = await device();

    const answer = await app.report({
      entryId: 'w_kvasha',
      type: 'stress',
      comment: '  Наголос на другому складі. ',
    });

    expect(answer).toBe('thanked');
    expect(app.api.received).toEqual([
      {
        editionId: 'uk',
        entryId: 'w_kvasha',
        type: 'stress',
        comment: 'Наголос на другому складі.',
        appVersion: '0.8.14',
        contentVersion: 42,
      },
    ]);
  });

  it('takes a sent report off the queue, so it is never sent again', async () => {
    const app = await device();
    await app.report();

    const relaunched = await app.relaunch();
    relaunched.foreground();
    await settle();

    expect(app.api.calls).toBe(1);
  });

  it('tries a report again by the one rule after a server error', async () => {
    const app = await device();
    app.api.failNext('server-error');

    expect(await app.report()).toBe('thanked');
    expect(app.api.calls).toBe(2);
    expect(app.received()).toEqual(['w_kvasha']);
  });
});

describe('reporting a mistake offline', () => {
  it('thanks, keeps the report after every try, and sends it at the launch back online', async () => {
    const app = await device();
    app.api.online = false;

    expect(await app.report()).toBe('thanked');
    // The first try and three more (ADR 0037).
    expect(app.api.calls).toBe(4);
    expect(app.received()).toEqual([]);

    app.api.online = true;
    const relaunched = await app.relaunch();
    relaunched.foreground();
    await app.advance(ALL_TRIES);

    expect(app.received()).toEqual(['w_kvasha']);
  });

  it('sends the queued reports on a return to the foreground, oldest first, and each once', async () => {
    const app = await device();
    app.api.online = false;
    await app.report(typoIn('first'));
    await app.report(typoIn('second'));

    app.api.online = true;
    app.reports.foreground();
    app.reports.foreground();
    await app.advance(ALL_TRIES);

    expect(app.received()).toEqual(['w_first', 'w_second']);
  });

  it('keeps the queue while the backend stays out of reach', async () => {
    const app = await device();
    app.api.online = false;
    await app.report(typoIn('first'));

    app.reports.foreground();
    await app.advance(ALL_TRIES);
    app.api.online = true;
    app.reports.foreground();
    await app.advance(ALL_TRIES);

    expect(app.received()).toEqual(['w_first']);
  });

  it('sends a queued report and a new one each once when both go out together', async () => {
    const app = await device();
    app.api.online = false;
    await app.report(typoIn('queued'));

    app.api.online = true;
    app.reports.foreground();
    const answer = await app.report(typoIn('new'));

    expect(answer).toBe('thanked');
    expect([...app.received()].sort()).toEqual(['w_new', 'w_queued']);
  });
});

describe('the queue of at most 20 unsent reports', () => {
  it('keeps 20, and a 21st pushes out the oldest (ADR 0056)', async () => {
    const app = await device();
    app.api.online = false;
    for (let report = 0; report <= MISTAKE_REPORT_QUEUE_SIZE; report += 1) {
      expect(await app.report(typoIn(`n${String(report)}`))).toBe('thanked');
    }

    app.api.online = true;
    app.reports.foreground();
    await app.advance(ALL_TRIES);

    expect(app.received()).toHaveLength(MISTAKE_REPORT_QUEUE_SIZE);
    expect(app.received()).not.toContain('w_n0');
    expect(app.received().at(-1)).toBe('w_n20');
  });
});

describe('too many reports today', () => {
  it('tells the reader of a report just written, and drops it, since they were told to try tomorrow', async () => {
    const app = await device();
    app.api.failNext('too-many-requests', { retryAfter: 3_600 });

    expect(await app.report()).toBe('too-many-requests');

    app.reports.foreground();
    await app.advance(ALL_TRIES);
    expect(app.api.calls).toBe(1);
    expect(app.received()).toEqual([]);
  });

  it('holds a queued report that meets the limit until `Retry-After`, and sends it then', async () => {
    const app = await device();
    app.api.online = false;
    await app.report();
    app.api.online = true;
    app.api.failNext('too-many-requests', { retryAfter: 3_600 });
    app.reports.foreground();
    await app.advance(ALL_TRIES);
    const calls = app.api.calls;

    app.reports.foreground();
    await app.advance(HOUR / 2);
    expect(app.api.calls).toBe(calls);

    await app.advance(HOUR);
    app.reports.foreground();
    await app.advance(ALL_TRIES);
    expect(app.received()).toEqual(['w_kvasha']);
  });

  it('keeps a queued report that meets the limit with no `Retry-After` for the next return', async () => {
    const app = await device();
    app.api.online = false;
    await app.report();
    app.api.online = true;
    app.api.failNext('too-many-requests');
    app.reports.foreground();
    await app.advance(ALL_TRIES);

    app.reports.foreground();
    await app.advance(ALL_TRIES);
    expect(app.received()).toEqual(['w_kvasha']);
  });
});

describe('a report the backend refuses', () => {
  it('drops a queued report refused with any other 4xx, since it would be refused again, and sends the next', async () => {
    const app = await device();
    app.api.online = false;
    await app.report(typoIn('refused'));
    await app.report(typoIn('next'));

    app.api.online = true;
    app.api.failNext('not-found');
    app.reports.foreground();
    await app.advance(ALL_TRIES);
    app.reports.foreground();
    await app.advance(ALL_TRIES);

    expect(app.received()).toEqual(['w_next']);
    expect(app.api.calls).toBe(2 * 4 + 2);
  });
});

describe('a draft that is no report', () => {
  it.each([
    ['«Інше» with no comment', { entryId: 'w_kvasha', type: 'other', comment: '   ' }],
    ['a comment over 500 characters', { ...typo, comment: 'а'.repeat(501) }],
    ['no Entry id', { ...typo, entryId: 'kvasha' }],
  ] satisfies [string, MistakeReportDraft][])(
    'sends and keeps nothing for %s',
    async (_, draft) => {
      const app = await device();

      expect(await app.report(draft)).toBe('invalid');

      app.reports.foreground();
      await app.advance(ALL_TRIES);
      expect(app.api.calls).toBe(0);
    },
  );

  it('takes «Інше» with a comment, and 500 characters', async () => {
    const app = await device();

    await app.report({ entryId: 'w_kvasha', type: 'other', comment: 'Приклад не про це.' });
    await app.report({ ...typo, comment: 'а'.repeat(500) });

    expect(app.api.received).toHaveLength(2);
  });
});

describe('the `mistakeReports` Feature Switch', () => {
  it('hides the action while off and shows it while on, read each time', async () => {
    const app = await device({ off: ['mistakeReports'] });
    expect(app.reports.available()).toBe(false);

    app.switchedOff.clear();
    expect(app.reports.available()).toBe(true);
  });

  it('sends and keeps nothing while off', async () => {
    const app = await device({ off: ['mistakeReports'] });

    expect(await app.report()).toBe('switched-off');

    app.switchedOff.clear();
    app.reports.foreground();
    await app.advance(ALL_TRIES);
    expect(app.api.calls).toBe(0);
  });

  it('keeps the queued reports while off and sends them once it is on again', async () => {
    const app = await device();
    app.api.online = false;
    await app.report();
    app.api.online = true;

    app.switchedOff.add('mistakeReports');
    app.reports.foreground();
    await app.advance(ALL_TRIES);
    expect(app.received()).toEqual([]);

    app.switchedOff.clear();
    app.reports.foreground();
    await app.advance(ALL_TRIES);
    expect(app.received()).toEqual(['w_kvasha']);
  });
});
