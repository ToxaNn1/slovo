import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  createSettings,
  openComposition,
  openCounterSending,
  openUserState,
  type FeatureSwitch,
} from '../index';
import { createFakeCountersApi, createMemoryContentPort } from '../testing';
import { fakeClock, randomOf, testEdition, testSchedule, word } from '../test-support';

/** Long enough for every wait between the tries of one request (ADR 0037). */
const ALL_TRIES = 10_000;

const MINUTE = 60_000;

const ids = Array.from({ length: 101 }, (_, index) => `w_${String(index).padStart(3, '0')}`);

const content = createMemoryContentPort({ words: ids.map((id) => word(id)) });

/**
 * A device of the Edition `test`: the Core composition, the settings and the
 * sending of the Community Counters over one user state and a fake backend,
 * with `knowledge` and `communityCounters` on unless the test turns one off.
 */
async function device() {
  const time = fakeClock('2026-10-28T09:00:00.000Z');
  const timers = testSchedule(time);
  const api = createFakeCountersApi();
  const switchedOff = new Set<FeatureSwitch>();
  const edition = testEdition({
    isFeatureEnabled: (feature) => !switchedOff.has(feature),
    userSettingDefaults: {
      mix: { corrections: false, idioms: false, synonymRows: false, tips: false },
    },
  });
  const userState = await openUserState({ port: createMemoryUserStatePort() });
  const app = await openComposition({
    content,
    edition,
    userState,
    clock: time.clock,
    random: randomOf(0.25),
  });
  const settings = createSettings({
    userState,
    defaults: { theme: 'system', fontSize: 'M', vibration: true, dailyLimit: 'off' },
  });
  const sending = openCounterSending({
    edition,
    api,
    userState,
    clock: time.clock,
    schedule: timers.schedule,
    random: randomOf(0.5),
  });
  return {
    app,
    api,
    settings,
    sending,
    switchedOff,
    advance: timers.advance,
    /** The app comes to the foreground and every try of what it sends runs. */
    async foreground() {
      sending.foreground();
      await timers.advance(ALL_TRIES);
    },
    /** The unsent changes as plain entries, for comparing. */
    unsent: async () => [...(await app.communityCounters.unsent())],
  };
}

// Spec #886 stories 44–46; ADR 0060: the device sends what it counted, batched.
describe('sending the Community Counters', () => {
  it('sends the unsent changes in one request with nothing but the events, and clears them', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    await phone.app.knowledge.tap('w_001', 'unknown');
    await phone.app.favorites.add('w_001');

    await phone.foreground();

    expect(phone.api.sent).toEqual([
      [
        { entryId: 'w_000', known: 1, unknown: 0, saved: 0 },
        { entryId: 'w_001', known: 0, unknown: 1, saved: 1 },
      ],
    ]);
    expect(await phone.unsent()).toEqual([]);
  });

  it('sends nothing when nothing is unsent', async () => {
    const phone = await device();

    await phone.foreground();

    expect(phone.api.sent).toEqual([]);
  });

  it('sends at most 100 Entries in a request, the rest in the next', async () => {
    const phone = await device();
    for (const id of ids) await phone.app.knowledge.tap(id, 'known');

    await phone.foreground();

    expect(phone.api.sent.map((events) => events.length)).toEqual([100, 1]);
    expect(await phone.unsent()).toEqual([]);
  });

  it('keeps the changes while offline and sends them on the next return', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    phone.api.online = false;

    await phone.foreground();
    expect(phone.api.sends).toBe(4);
    expect(await phone.unsent()).toEqual([['w_000', { known: 1, unknown: 0, saved: 0 }]]);

    phone.api.online = true;
    await phone.foreground();
    expect(phone.api.sent).toEqual([[{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }]]);
    expect(await phone.unsent()).toEqual([]);
  });

  it('keeps a change made while its request was out, and sends it next', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    phone.api.failSend('server-error');

    phone.sending.foreground();
    await phone.app.knowledge.tap('w_000', 'unknown');
    await phone.advance(ALL_TRIES);

    expect(phone.api.sent).toEqual([
      [{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }],
      [{ entryId: 'w_000', known: -1, unknown: 1, saved: 0 }],
    ]);
    expect(await phone.unsent()).toEqual([]);
  });

  it('waits for Retry-After after too many requests', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    phone.api.failSend('too-many-requests', { retryAfter: 3600 });

    await phone.foreground();
    expect(phone.api.sends).toBe(1);
    await phone.advance(59 * MINUTE);
    await phone.foreground();
    expect(phone.api.sends).toBe(1);

    await phone.advance(MINUTE);
    await phone.foreground();
    expect(phone.api.sent).toEqual([[{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }]]);
  });

  it('drops a batch the backend refuses as wrong, and keeps one for an Edition it does not find', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');

    phone.api.failSend('not-found');
    await phone.foreground();
    expect(await phone.unsent()).toEqual([['w_000', { known: 1, unknown: 0, saved: 0 }]]);

    phone.api.failSend('unexpected');
    await phone.foreground();
    expect(await phone.unsent()).toEqual([]);
    expect(phone.api.sent).toEqual([]);
  });

  it('sends again while the app is open, and not in the background', async () => {
    const phone = await device();
    await phone.foreground();

    await phone.app.knowledge.tap('w_000', 'known');
    await phone.advance(5 * MINUTE);
    expect(phone.api.sent).toEqual([[{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }]]);

    phone.sending.background();
    await phone.app.knowledge.tap('w_001', 'known');
    await phone.advance(60 * MINUTE);
    expect(phone.api.sent).toHaveLength(1);
  });

  it('sends nothing with the communityCounters Feature Switch off, and keeps what waits', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    phone.switchedOff.add('communityCounters');

    await phone.foreground();
    expect(phone.api.sends).toBe(0);

    phone.switchedOff.delete('communityCounters');
    await phone.foreground();
    expect(phone.api.sent).toEqual([[{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }]]);
  });
});

// Spec #886 story 47; ADR 0060: «Ділитися анонімною статистикою».
describe('sharing the Community Counters', () => {
  it('is on by default', async () => {
    const phone = await device();

    expect((await phone.settings.read()).shareCounters).toBe(true);
  });

  it('turned off, empties what waits, sends nothing and counts nothing', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');

    await phone.settings.update({ shareCounters: false });
    expect(await phone.unsent()).toEqual([]);

    await phone.app.knowledge.tap('w_001', 'known');
    await phone.app.favorites.add('w_001');
    await phone.foreground();

    expect(await phone.unsent()).toEqual([]);
    expect(phone.api.sends).toBe(0);
  });

  it('turned on again, counts as new what was never sent', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    await phone.settings.update({ shareCounters: false });
    await phone.app.knowledge.tap('w_001', 'unknown');

    await phone.settings.update({ shareCounters: true });
    await phone.app.knowledge.tap('w_000', 'known');
    await phone.app.knowledge.tap('w_001', 'known');
    await phone.foreground();

    expect(phone.api.sent).toEqual([[{ entryId: 'w_001', known: 1, unknown: 0, saved: 0 }]]);
  });

  it('turned off, takes back only what was not sent', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    await phone.foreground();
    await phone.app.knowledge.tap('w_000', 'unknown');

    await phone.settings.update({ shareCounters: false });
    await phone.settings.update({ shareCounters: true });
    await phone.app.knowledge.tap('w_000', 'unknown');
    await phone.foreground();

    expect(phone.api.sent).toEqual([
      [{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }],
      [{ entryId: 'w_000', known: -1, unknown: 0, saved: 0 }],
    ]);
  });
});
