import { describe, expect, it, vi } from 'vitest';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type ContentReadPort,
  type Schedule,
  type UserStatePort,
} from './index';
import { createFakeNotificationScheduler, createMemoryContentPort } from './testing';
import { fakeClock, word } from './test-support';

const SECOND = 1000;

/** Twenty Words of the Category in the Mix. */
const content = createMemoryContentPort({
  categories: [{ id: 'test', displayName: 'Test' }],
  words: Array.from({ length: 20 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`)),
});

/**
 * The Core composition of one app run over the records, at 08:00 before the
 * first Notification time, so the Word of the Day is Reserved for 09:00.
 */
async function run({
  records = new Map<string, string>(),
  port = createMemoryUserStatePort(records),
  pack = content,
  schedule,
}: {
  records?: Map<string, string>;
  port?: UserStatePort;
  pack?: ContentReadPort;
  schedule?: Schedule;
} = {}) {
  const time = fakeClock('2026-10-14T08:00:00+03:00');
  const scheduler = createFakeNotificationScheduler();
  const app = await openComposition({
    content: pack,
    edition: {
      id: 'test',
      isFeatureEnabled: () => true,
      languageTraits: { distractorRule: 'same-part-of-speech' },
      userSettingDefaults: {
        mix: { categoryIds: ['test'], corrections: true, idioms: true },
        notificationTimes: ['09:00', '13:00', '19:00'],
      },
    },
    userState: await openUserState({ port }),
    clock: time.clock,
    random: { next: () => 0.25 },
    scheduling: { scheduler, ellipsis: '…' },
    ...(schedule === undefined ? {} : { schedule }),
  });
  return { app, time, scheduler, records };
}

describe('a closed composition', () => {
  it('keeps nothing of a card that leaves the screen, a Reserved Word included, and plans nothing', async () => {
    const { app, time, scheduler, records } = await run();
    await app.feed.show(0);
    time.advance(2 * SECOND);
    const kept = new Map(records);
    const plan = scheduler.plan;

    await app.close();
    await app.feed.show(undefined);
    await app.feed.show(1);

    expect(records).toEqual(kept);
    expect(scheduler.plan).toBe(plan);
  });

  it('turns to no new day: it writes no Active Day and makes no plan', async () => {
    const { app, time, scheduler, records } = await run();
    const kept = new Map(records);
    const plan = scheduler.plan;

    await app.close();
    time.advance(24 * 60 * 60 * SECOND);
    await app.resume();
    await app.notifications.keepTime('11:00');

    expect(records).toEqual(kept);
    expect(scheduler.plan).toBe(plan);
  });

  it('takes no hide back: an undo held from before the close restores nothing', async () => {
    const { app, scheduler, records } = await run();
    const hidden = await app.hide({ kind: 'entry', entryId: 'w_05' });
    const kept = new Map(records);
    const plan = scheduler.plan;

    await app.close();
    await hidden?.undo();

    expect(records).toEqual(kept);
    expect(scheduler.plan).toBe(plan);
  });

  it("stops the Game's tries to plan its offers again", async () => {
    const waiting = new Set<() => void>();
    const schedule: Schedule = (later) => {
      waiting.add(later);
      return () => waiting.delete(later);
    };
    const failing: ContentReadPort = {
      ...content,
      listWords: () => Promise.reject(new Error('The pack failed to read')),
    };
    const { app } = await run({ pack: failing, schedule });
    // The first planning fails and waits a second to try again.
    await app.game.next();
    expect(waiting.size).toBe(1);

    await app.close();
    await app.resume();

    expect(waiting.size).toBe(0);
  });

  it('settles once the writes under way end, and keeps them', async () => {
    const records = new Map<string, string>();
    const memory = createMemoryUserStatePort(records);
    const held: (() => void)[] = [];
    let holding = false;
    const port: UserStatePort = {
      ...memory,
      async write(changes) {
        if (holding) await new Promise<void>((resolve) => held.push(resolve));
        return memory.write(changes);
      },
    };
    const { app } = await run({ records, port });
    holding = true;
    const added = app.favorites.add('w_03');
    await vi.waitFor(() => {
      expect(held).toHaveLength(1);
    });

    let closed = false;
    const closing = app.close().then(() => (closed = true));
    // Every promise the composition started settles meanwhile, but the held write.
    for (let tick = 0; tick < 1_000; tick += 1) await Promise.resolve();
    expect(closed).toBe(false);
    held[0]?.();
    await Promise.all([added, closing]);

    expect(records.has('favorites.w_03')).toBe(true);
  });
});
