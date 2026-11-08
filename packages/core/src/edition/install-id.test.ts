import { describe, expect, it } from 'vitest';

import { openComposition, openCounterSending, openMistakeReports, readInstallId } from '../index';
import type { Random } from '../ports';
import { fakeClock, randomOf, testEdition, testSchedule, word } from '../test-support';
import { createFakeBackend, createMemoryContentPort } from '../testing';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { syncs } from '../user-state-schema';

/** Long enough for every wait between the tries of one request (ADR 0037). */
const ALL_TRIES = 10_000;

/** A random port with its own stream of numbers, so two devices differ. */
function streamRandom(seed: number): Random {
  let state = seed;
  return {
    next: () => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state / 2_147_483_648;
    },
  };
}

/** A device with its own user state; `launch` reads the Install id as a new launch would. */
function device(random: Random = streamRandom(7)) {
  const records = new Map<string, string>();
  const userState = () => openUserState({ port: createMemoryUserStatePort(records) });
  return {
    userState,
    launch: async () => readInstallId({ userState: await userState(), random }),
  };
}

describe('the Install id', () => {
  it('is made on the first launch and kept for every later one', async () => {
    const phone = device();

    const first = await phone.launch();
    const second = await phone.launch();

    expect(first).toMatch(/^[0-9a-z]{20}$/);
    expect(second).toBe(first);
  });

  it('differs between devices', async () => {
    expect(await device(streamRandom(1)).launch()).not.toBe(await device(streamRandom(2)).launch());
  });

  it('never leaves the device: no sync, no counters request, no mistake report carries it', async () => {
    const time = fakeClock('2026-10-28T09:00:00.000Z');
    const timers = testSchedule(time);
    const api = createFakeBackend();
    const edition = testEdition({ isFeatureEnabled: () => true });
    const phone = device();
    const installId = await phone.launch();
    const userState = await phone.userState();
    const content = createMemoryContentPort({ words: [word('w_000')] });
    const app = await openComposition({
      content,
      edition,
      userState,
      clock: time.clock,
      random: randomOf(0.25),
    });
    const ports = {
      edition,
      backend: api.backend,
      userState,
      clock: time.clock,
      schedule: timers.schedule,
      random: randomOf(0.5),
    };
    const sending = openCounterSending(ports);
    const reports = openMistakeReports({ ...ports, appVersion: '0.8.14', contentVersion: 42 });

    await app.knowledge.tap('w_000', 'known');
    sending.foreground();
    const answer = reports.report({ entryId: 'w_000', type: 'typo', comment: '' });
    await timers.advance(ALL_TRIES);

    expect(syncs('edition.installId')).toBe(false);
    expect(api.counters.sent.length).toBeGreaterThan(0);
    expect(await answer).toBe('thanked');
    expect(JSON.stringify([api.counters.sent, api.reports.received])).not.toContain(installId);
  });
});
