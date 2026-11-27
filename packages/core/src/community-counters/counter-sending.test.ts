import { describe, expect, it } from 'vitest';

import { createSettings, openComposition, openCounterSending, type FeatureSwitch } from '../index';
import type { UserStatePort } from '../ports';
import { createFakeBackend, createMemoryContentPort } from '../testing';
import { fakeClock, randomOf, settle, testEdition, testSchedule, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

/** Long enough for every wait between the tries of one request. */
const ALL_TRIES = 10_000;

const MINUTE = 60_000;

const ids = Array.from({ length: 101 }, (_, index) => `w_${String(index).padStart(3, '0')}`);

const content = createMemoryContentPort({ words: ids.map((id) => word(id)) });

/**
 * A device of the Edition `test`: the Core composition, the settings and the
 * sending of the Community Counters over one user state and a fake backend,
 * with `knowledge` and `communityCounters` on unless the test turns one off.
 */
async function device(port: UserStatePort = createMemoryUserStatePort()) {
  const time = fakeClock('2026-10-28T09:00:00.000Z');
  const timers = testSchedule(time);
  const api = createFakeBackend();
  const switchedOff = new Set<FeatureSwitch>();
  const edition = testEdition({
    isFeatureEnabled: (feature) => !switchedOff.has(feature),
    userSettingDefaults: {
      mix: { kinds: { correction: false, idiom: false, synonymRow: false, tip: false } },
    },
  });
  const userState = await openUserState({ port });
  const app = await openComposition({
    content,
    edition,
    userState,
    clock: time.clock,
    random: randomOf(0.25),
  });
  const settings = createSettings({
    userState,
    defaults: {
      theme: 'system',
      textSize: 'system',
      vibration: true,
      narratorVoice: 'anna',
    },
  });
  const sending = openCounterSending({
    edition,
    backend: api.backend,
    userState,
    clock: time.clock,
    schedule: timers.schedule,
    random: randomOf(0.5),
  });
  return {
    app,
    api,
    userState,
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

/**
 * A user-state port that, once `hold` is called, keeps the next write of the
 * record back until `release`, so a test puts another change between what a
 * module read and what it writes.
 */
function holdingPort(key: string) {
  const port = createMemoryUserStatePort();
  let armed = false;
  let release: () => void = () => undefined;
  return {
    port: {
      ...port,
      async write(changes) {
        if (armed && changes.has(key)) {
          armed = false;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        await port.write(changes);
      },
    } satisfies UserStatePort,
    hold() {
      armed = true;
    },
    release: () => {
      release();
    },
  };
}

// Spec #886 stories 44–46: the device sends what it counted, batched.
describe('sending the Community Counters', () => {
  it('sends the unsent changes in one request with nothing but the events, and clears them', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    await phone.app.knowledge.tap('w_001', 'unknown');
    await phone.app.favorites.add('w_001');

    await phone.foreground();

    expect(phone.api.counters.sent).toEqual([
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

    expect(phone.api.counters.sent).toEqual([]);
  });

  it('sends at most 100 Entries in a request, the rest in the next', async () => {
    const phone = await device();
    for (const id of ids) await phone.app.knowledge.tap(id, 'known');

    await phone.foreground();

    expect(phone.api.counters.sent.map((events) => events.length)).toEqual([100, 1]);
    expect(await phone.unsent()).toEqual([]);
  });

  it('keeps the changes while offline and sends them on the next return', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    phone.api.online = false;

    await phone.foreground();
    expect(phone.api.calls).toHaveLength(4);
    expect(await phone.unsent()).toEqual([['w_000', { known: 1, unknown: 0, saved: 0 }]]);

    phone.api.online = true;
    await phone.foreground();
    expect(phone.api.counters.sent).toEqual([
      [{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }],
    ]);
    expect(await phone.unsent()).toEqual([]);
  });

  it('keeps a change made while its request was out, and sends it next', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    phone.api.failNext('server-error');

    phone.sending.foreground();
    await phone.app.knowledge.tap('w_000', 'unknown');
    await phone.advance(ALL_TRIES);

    expect(phone.api.counters.sent).toEqual([
      [{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }],
      [{ entryId: 'w_000', known: -1, unknown: 1, saved: 0 }],
    ]);
    expect(await phone.unsent()).toEqual([]);
  });

  it('keeps a change counted while a sent batch leaves the unsent changes', async () => {
    const unsentKey = userStateRecords.countersUnsent.record('w_000').key;
    const held = holdingPort(unsentKey);
    const phone = await device(held.port);
    await phone.app.knowledge.tap('w_000', 'known');

    // The backend counted the batch, and the write that takes it off waits.
    held.hold();
    phone.sending.foreground();
    await phone.advance(0);
    expect(phone.api.counters.sent).toHaveLength(1);
    const added = phone.app.favorites.add('w_000');
    await phone.advance(0);
    held.release();
    await added;
    await phone.advance(0);

    expect(await phone.unsent()).toEqual([['w_000', { known: 0, unknown: 0, saved: 1 }]]);
  });

  it('sends a change once when a batch is counted while another change is being kept', async () => {
    const unsentKey = userStateRecords.countersUnsent.record('w_000').key;
    const held = holdingPort(unsentKey);
    const phone = await device(held.port);
    await phone.app.knowledge.tap('w_000', 'known');

    // The Favorite's write waits, having read the unsent changes, while the batch is counted.
    held.hold();
    const added = phone.app.favorites.add('w_000');
    await phone.advance(0);
    phone.sending.foreground();
    await phone.advance(0);
    expect(phone.api.counters.sent).toEqual([
      [{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }],
    ]);
    held.release();
    await added;
    await phone.advance(0);

    // The drain goes on with the Favorite alone: the mark is not sent again.
    expect(phone.api.counters.sent).toEqual([
      [{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }],
      [{ entryId: 'w_000', known: 0, unknown: 0, saved: 1 }],
    ]);
    expect(await phone.unsent()).toEqual([]);
  });

  it('takes back a mark removed while its request was out', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    phone.api.failNext('server-error');

    phone.sending.foreground();
    await phone.app.knowledge.tap('w_000', 'known');
    await phone.advance(ALL_TRIES);

    expect(phone.api.counters.sent).toEqual([
      [{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }],
      [{ entryId: 'w_000', known: -1, unknown: 0, saved: 0 }],
    ]);
    expect(await phone.unsent()).toEqual([]);
  });

  it('forgets an unsent change that taking off what was sent leaves out of range', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    phone.api.failNext('server-error');

    phone.sending.foreground();
    await phone.advance(0);
    await phone.userState.write(
      userStateRecords.countersUnsent.record('w_000').change({ known: -1, unknown: 0, saved: 0 }),
    );
    await phone.advance(ALL_TRIES);
    expect(phone.api.counters.sent).toEqual([
      [{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }],
    ]);
    expect(await phone.unsent()).toEqual([]);

    await phone.foreground();
    expect(phone.api.counters.sent).toHaveLength(1);
  });

  it('waits for Retry-After after too many requests', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    phone.api.failNext({ reason: 'too-many-requests', retryAfter: 3600 });

    await phone.foreground();
    expect(phone.api.calls).toHaveLength(1);
    await phone.advance(59 * MINUTE);
    await phone.foreground();
    expect(phone.api.calls).toHaveLength(1);

    await phone.advance(MINUTE);
    await phone.foreground();
    expect(phone.api.counters.sent).toEqual([
      [{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }],
    ]);
  });

  it('drops a batch the backend refuses as wrong, and keeps one for an Edition it does not find', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');

    phone.api.failNext('not-found');
    await phone.foreground();
    expect(await phone.unsent()).toEqual([['w_000', { known: 1, unknown: 0, saved: 0 }]]);

    phone.api.failNext('unexpected');
    await phone.foreground();
    expect(await phone.unsent()).toEqual([]);
    expect(phone.api.counters.sent).toEqual([]);
  });

  it('a refused batch takes back nothing the backend never counted, and a later mark counts as new', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    phone.api.failNext('unexpected');
    const release = phone.api.hold();

    phone.sending.foreground();
    await phone.app.knowledge.tap('w_000', 'known');
    release();
    await phone.advance(ALL_TRIES);
    expect(await phone.unsent()).toEqual([]);

    await phone.app.knowledge.tap('w_000', 'known');
    await phone.foreground();
    expect(phone.api.counters.sent).toEqual([
      [{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }],
    ]);
  });

  it('sends again while the app is open, and not in the background', async () => {
    const phone = await device();
    await phone.foreground();

    await phone.app.knowledge.tap('w_000', 'known');
    await phone.advance(5 * MINUTE);
    expect(phone.api.counters.sent).toEqual([
      [{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }],
    ]);

    phone.sending.background();
    await phone.app.knowledge.tap('w_001', 'known');
    await phone.advance(60 * MINUTE);
    expect(phone.api.counters.sent).toHaveLength(1);
  });

  it('adds what the backend counted to the numbers read, never below zero', async () => {
    const phone = await device();
    const { countersRead } = userStateRecords;
    const readAt = '2026-10-28T08:00:00.000Z';
    await phone.app.knowledge.tap('w_001', 'known');
    await phone.foreground();
    phone.sending.background();
    await phone.userState.write(
      new Map([
        ...countersRead.record('w_000').change({ readAt, known: 5, unknown: 3, saved: 2 }),
        ...countersRead.record('w_001').change({ readAt, known: 0, unknown: 4, saved: 0 }),
      ]),
    );
    await phone.app.knowledge.tap('w_000', 'known');
    await phone.app.favorites.add('w_000');
    await phone.app.knowledge.tap('w_001', 'unknown');

    await phone.foreground();

    expect(await phone.userState.read(countersRead.record('w_000'))).toEqual({
      readAt,
      known: 6,
      unknown: 3,
      saved: 3,
    });
    expect(await phone.userState.read(countersRead.record('w_001'))).toEqual({
      readAt,
      known: 0,
      unknown: 5,
      saved: 0,
    });
    expect(await phone.userState.read(countersRead.record('w_002'))).toBeUndefined();
  });

  it('sends again once Retry-After has passed to the millisecond', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    phone.api.failNext({ reason: 'too-many-requests', retryAfter: 60 });
    const sendNow = async () => {
      phone.sending.foreground();
      await phone.advance(0);
      phone.sending.background();
    };

    await sendNow();
    await phone.advance(MINUTE - 1);
    await sendNow();
    expect(phone.api.calls).toHaveLength(1);

    await phone.advance(1);
    await sendNow();
    expect(phone.api.counters.sent).toEqual([
      [{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }],
    ]);
  });

  it('a refused batch drops only its own Entries, and keeps a change counted meanwhile', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    phone.api.failNext('unexpected');
    const release = phone.api.hold();

    phone.sending.foreground();
    await phone.advance(0);
    await phone.app.knowledge.tap('w_001', 'unknown');
    release();
    await phone.advance(ALL_TRIES);

    expect(phone.api.counters.sent).toEqual([
      [{ entryId: 'w_001', known: 0, unknown: 1, saved: 0 }],
    ]);
    expect(await phone.unsent()).toEqual([]);
  });

  it('sends one request at a time, and a send asked for during one runs once more after it', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    phone.api.failNext('not-found');
    const release = phone.api.hold();

    phone.sending.foreground();
    await phone.advance(0);
    phone.sending.foreground();
    await phone.advance(0);
    expect(phone.api.calls).toHaveLength(1);

    release();
    await phone.advance(0);
    expect(phone.api.calls).toHaveLength(2);
    expect(phone.api.counters.sent).toEqual([
      [{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }],
    ]);
  });

  it('going to the background before ever coming to the foreground sends nothing', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');

    phone.sending.background();
    await phone.advance(60 * MINUTE);

    expect(phone.api.calls).toHaveLength(0);
  });

  it('sends nothing with the communityCounters Feature Switch off, and keeps what waits', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    phone.switchedOff.add('communityCounters');

    await phone.foreground();
    expect(phone.api.calls).toHaveLength(0);

    phone.switchedOff.delete('communityCounters');
    await phone.foreground();
    expect(phone.api.counters.sent).toEqual([
      [{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }],
    ]);
  });
});

// Spec #886 story 47: «Ділитися анонімною статистикою».
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
    expect(phone.api.calls).toHaveLength(0);
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

    expect(phone.api.counters.sent).toEqual([
      [{ entryId: 'w_001', known: 1, unknown: 0, saved: 0 }],
    ]);
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

    expect(phone.api.counters.sent).toEqual([
      [{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }],
      [{ entryId: 'w_000', known: -1, unknown: 0, saved: 0 }],
    ]);
  });

  it('turned off, keeps a sent mark counted when only a Favorite of the Entry waited', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    await phone.app.knowledge.tap('w_001', 'unknown');
    await phone.foreground();
    await phone.app.favorites.add('w_000');
    await phone.app.favorites.add('w_001');

    await phone.settings.update({ shareCounters: false });
    await phone.settings.update({ shareCounters: true });
    await phone.app.knowledge.tap('w_000', 'known');
    await phone.app.knowledge.tap('w_001', 'unknown');
    await phone.foreground();

    expect(phone.api.counters.sent.at(-1)).toEqual([
      { entryId: 'w_000', known: -1, unknown: 0, saved: 0 },
      { entryId: 'w_001', known: 0, unknown: -1, saved: 0 },
    ]);
  });

  it('turned off, keeps a sent Favorite counted when only a mark of the Entry waited', async () => {
    const phone = await device();
    await phone.app.favorites.add('w_000');
    await phone.foreground();
    await phone.app.knowledge.tap('w_000', 'known');

    await phone.settings.update({ shareCounters: false });
    await phone.settings.update({ shareCounters: true });
    await phone.app.favorites.remove('w_000');
    await phone.foreground();

    expect(phone.api.counters.sent.at(-1)).toEqual([
      { entryId: 'w_000', known: 0, unknown: 0, saved: -1 },
    ]);
  });

  it('turned off, keeps no counted record of an Entry it never sent', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');

    await phone.settings.update({ shareCounters: false });

    expect(
      await phone.userState.read(userStateRecords.countersCounted.record('w_000')),
    ).toBeUndefined();
  });

  it('turned off while a mark is being counted, leaves nothing waiting', async () => {
    const held = holdingPort('counters.unsent.w_000');
    const phone = await device(held.port);
    held.hold();
    const tapped = phone.app.knowledge.tap('w_000', 'known');
    await settle();

    const off = phone.settings.update({ shareCounters: false });
    await settle();
    held.release();
    await Promise.all([tapped, off]);

    expect(await phone.unsent()).toEqual([]);
    await phone.foreground();
    expect(phone.api.calls).toHaveLength(0);
  });

  it('turned off while a request is out, counts from what the backend counted', async () => {
    const phone = await device();
    await phone.app.knowledge.tap('w_000', 'known');
    phone.api.failNext('server-error');

    phone.sending.foreground();
    await phone.settings.update({ shareCounters: false });
    await phone.advance(ALL_TRIES);
    expect(await phone.unsent()).toEqual([]);

    await phone.settings.update({ shareCounters: true });
    await phone.app.knowledge.tap('w_000', 'unknown');
    await phone.foreground();

    expect(phone.api.counters.sent).toEqual([
      [{ entryId: 'w_000', known: 1, unknown: 0, saved: 0 }],
      [{ entryId: 'w_000', known: -1, unknown: 1, saved: 0 }],
    ]);
  });
});
