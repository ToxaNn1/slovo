import { describe, expect, it } from 'vitest';

import { openComposition } from '../index';
import type { Backend } from '../ports';
import { createFakeBackend, createMemoryContentPort } from '../testing';
import { fakeClock, randomOf, testEdition, word } from '../test-support';
import { trackChanges } from '../user-state/tracked-user-state';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { createSyncExchange } from './exchange';
import { signInByCode } from '../fakes/fake-backend';

// ADR 0205: XP days across the devices of one Account, and on the backend.

const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
  words: [word('w_01')],
});

const edition = testEdition({ isFeatureEnabled: () => true });

const round = (date: string, hour: number) =>
  `{"kind":"xp","date":"${date}","at":"${date}T${String(hour).padStart(2, '0')}:00:00.000Z","source":"game-round","amount":1,"mode":"definition","rarity":3}`;

/** Three Rounds of one day, as a device kept them. */
const rounds = () =>
  new Map([
    ['xp.round-a', round('2026-09-01', 9)],
    ['xp.round-b', round('2026-09-01', 10)],
    ['xp.round-c', round('2026-09-01', 11)],
  ]);

/** One Account on a fake backend, and the devices signed into it, on one clock. */
function account(start = '2026-09-02T09:00:00.000Z') {
  const time = fakeClock(start);
  const server = createFakeBackend({ clock: time.clock });

  async function device(
    records = new Map<string, string>(),
    backend: Pick<Backend, 'sync'> = server.backend,
  ) {
    const userState = trackChanges({
      userState: await openUserState({ port: createMemoryUserStatePort(records) }),
      clock: time.clock,
    });
    const exchange = createSyncExchange({ userState, backend, editionId: 'uk' });
    const { token } = await signInByCode(server);
    return {
      records,
      userState,
      sync: () => exchange.sync(token),
      /** Opens the composition as a launch does, which folds the days past 30, and answers its XP. */
      async launch() {
        const { xpLog } = await openComposition({
          content,
          edition,
          userState,
          clock: time.clock,
          random: randomOf(0.25),
        });
        return xpLog.state.total;
      },
    };
  }

  /** The keys of the records the Account keeps under the prefix, a tombstone not one: only they count toward its limit. */
  const kept = (prefix: string) =>
    [...server.sync.recordsOf('anna@mail.com')]
      .filter(([key, { value }]) => key.startsWith(prefix) && value !== null)
      .map(([key]) => key)
      .sort();

  return { time, server, device, kept };
}

const keysOf = (records: Map<string, string>, prefix: string) =>
  [...records.keys()].filter((key) => key.startsWith(prefix)).sort();

describe('the XP days of two devices of one Account', () => {
  it('leave the Account one XP day and only tombstones of the records of the folded day', async () => {
    const { time, device, kept } = account();
    const phone = await device(rounds());
    await phone.sync();
    expect(kept('xp.')).toHaveLength(3);

    time.set('2026-10-14T09:00:00.000Z');
    await phone.launch();
    await phone.sync();

    expect(kept('xp.')).toEqual([]);
    expect(kept('xpDay.')).toHaveLength(1);
  });

  it('keep the XP of a device that still has the records, which it deletes at its next launch', async () => {
    const { time, device, kept } = account();
    const phone = await device(rounds());
    const tablet = await device();
    await phone.sync();
    await tablet.sync();
    time.set('2026-10-14T09:00:00.000Z');
    await phone.launch();
    await phone.sync();

    // The tablet still holds the three records and now pulls the XP day beside them.
    await tablet.sync();
    expect(keysOf(tablet.records, 'xp.')).toHaveLength(3);
    expect(await tablet.launch()).toBe(3);
    await tablet.sync();

    expect(keysOf(tablet.records, 'xp.')).toEqual([]);
    expect(await tablet.launch()).toBe(3);
    expect(kept('xp.')).toEqual([]);
    expect(kept('xpDay.')).toHaveLength(1);
  });

  it('neither double nor lose a record another device earned on a day already folded', async () => {
    const { time, device, kept } = account();
    const phone = await device(rounds());
    const tablet = await device();
    await phone.sync();
    await tablet.sync();
    // Offline, the tablet earns one more Round on that day.
    await tablet.userState.write(new Map([['xp.round-late', round('2026-09-01', 12)]]));
    time.set('2026-10-14T09:00:00.000Z');
    await phone.launch();
    await phone.sync();

    await tablet.sync();
    expect(await tablet.launch()).toBe(4);
    await tablet.sync();
    await phone.sync();

    expect(await phone.launch()).toBe(4);
    expect(await tablet.launch()).toBe(4);
    expect(kept('xp.')).toEqual([]);
    await phone.sync();
    await tablet.sync();
    expect(await phone.launch()).toBe(4);
    expect(await tablet.launch()).toBe(4);
  });

  it('agree when both fold the same day before either syncs', async () => {
    const { time, device, kept } = account();
    const phone = await device(rounds());
    const tablet = await device();
    await phone.sync();
    await tablet.sync();
    time.set('2026-10-14T09:00:00.000Z');

    await phone.launch();
    await tablet.launch();
    await phone.sync();
    await tablet.sync();
    await phone.sync();

    expect(await phone.launch()).toBe(3);
    expect(await tablet.launch()).toBe(3);
    expect(kept('xp.')).toEqual([]);
    expect(kept('xpDay.')).toHaveLength(1);
  });

  it('give a device signed in anew the XP of the folded days', async () => {
    const { time, device } = account();
    const phone = await device(rounds());
    await phone.sync();
    time.set('2026-10-14T09:00:00.000Z');
    await phone.launch();
    await phone.sync();

    const fresh = await device();
    await fresh.sync();

    expect(await fresh.launch()).toBe(3);
  });

  it('keep off the Account the records a device that never folded sends again at its first sync', async () => {
    const { time, device, kept } = account();
    const phone = await device(rounds());
    await phone.sync();
    time.set('2026-10-14T09:00:00.000Z');
    await phone.launch();
    await phone.sync();
    // A device that kept the records and never folded, signing in anew: the tombstones are later.
    const stale = await device(rounds());
    await stale.sync();
    expect(kept('xp.')).toEqual([]);

    expect(await stale.launch()).toBe(3);
    await stale.sync();

    expect(keysOf(stale.records, 'xp.')).toEqual([]);
    expect(kept('xp.')).toEqual([]);
    expect(kept('xpDay.')).toHaveLength(1);
    expect(await stale.launch()).toBe(3);
  });
});

describe('a push of Sync', () => {
  it('never deletes a folded record from the Account before the XP day that holds it is there', async () => {
    const { time, server, device } = account();
    // 600 Rounds over 20 days: more than one push of deletions once they fold.
    const old = new Map(
      Array.from({ length: 600 }, (_, index): [string, string] => [
        `xp.round-${String(index).padStart(3, '0')}`,
        round(`2026-08-${String((index % 20) + 1).padStart(2, '0')}`, index % 24),
      ]),
    );
    let pushes = 0;
    let failing = false;
    const phone = await device(old, {
      sync: {
        pull: (input, options) => server.backend.sync.pull(input, options),
        push: (input, options) => {
          pushes += 1;
          return failing && pushes > 1
            ? Promise.reject(new TypeError('Network request failed'))
            : server.backend.sync.push(input, options);
        },
      },
    });
    await phone.sync();
    time.set('2026-10-14T09:00:00.000Z');
    expect(await phone.launch()).toBe(600);
    pushes = 0;
    failing = true;

    // The first push of the fold reaches the Account, the next fails.
    expect(await phone.sync()).toMatchObject({ ok: false, reason: 'offline' });

    const fresh = await device();
    await fresh.sync();
    expect(await fresh.launch()).toBe(600);
  });

  it('sends the deletions first, so they free room in the Account before a record is added', async () => {
    const { time, server, device } = account();
    const pushes: { key: string; value: unknown }[][] = [];
    const phone = await device(new Map(), {
      sync: {
        pull: (input, options) => server.backend.sync.pull(input, options),
        push: (input, options) => {
          pushes.push(input.changes);
          return server.backend.sync.push(input, options);
        },
      },
    });
    await phone.userState.write(new Map([['favorites.w_01', '"2026-09-01T09:00:00.000Z"']]));
    await phone.sync();
    pushes.length = 0;
    time.advance(60_000);
    await phone.userState.write(
      new Map<string, string | undefined>([
        ...Array.from({ length: 600 }, (_, index): [string, string] => [
          `activeDays.2${String(index).padStart(3, '0')}-01-01`,
          'true',
        ]),
        ['favorites.w_01', undefined],
      ]),
    );

    await phone.sync();

    expect(pushes).toHaveLength(2);
    expect(pushes[0]?.[0]).toMatchObject({ key: 'favorites.w_01', value: null });
  });
});
