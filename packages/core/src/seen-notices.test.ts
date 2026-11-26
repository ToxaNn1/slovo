import { describe, expect, it } from 'vitest';

import { openComposition, type FeatureSwitch } from './index';
import { SEEN_DWELL_MS } from './feed/feed';
import { createMemoryContentPort } from './testing';
import { fakeClock, settle, steppingRandom, testEdition, word } from './test-support';
import { createMemoryUserStatePort, openUserState } from './user-state/user-state';
import { type UserStatePort } from './ports';

// Ticket #1119: one Seen tells the subscribers of each store once.

const content = createMemoryContentPort({
  words: Array.from({ length: 8 }, (_, index) => word(`w_${String(index)}`)),
});

const ON: readonly FeatureSwitch[] = [
  'xpLog',
  'seenWordXp',
  'dailyGoal',
  'levels',
  'badges',
  'streakFreezes',
  'knowledge',
];

/** The Core composition of one app run, with the Daily Goal the test names. */
async function run(
  goal: number | null,
  port: UserStatePort = createMemoryUserStatePort(new Map()),
) {
  const time = fakeClock('2026-10-14T08:00:00+03:00');
  const app = await openComposition({
    content,
    edition: testEdition({ isFeatureEnabled: (feature) => ON.includes(feature) }),
    userState: await openUserState({ port }),
    clock: time.clock,
    random: steppingRandom(),
  });
  await app.xpLog.setDailyGoal(goal);
  await settle();
  return { app, time };
}

type App = Awaited<ReturnType<typeof run>>['app'];

/** Counts what each store tells its subscribers from now on. */
function counting(app: App) {
  const told = { history: 0, xpLog: 0, progress: 0, badges: 0 };
  app.history.subscribe(() => (told.history += 1));
  app.xpLog.subscribe(() => (told.xpLog += 1));
  app.progress.subscribe(() => (told.progress += 1));
  app.badges.subscribe(() => (told.badges += 1));
  return told;
}

/** Keeps the card at the position on screen for the dwell, so its Entry is Seen. */
async function see({ app, time }: Awaited<ReturnType<typeof run>>, position: number) {
  await app.feed.show(position);
  time.advance(SEEN_DWELL_MS);
  await app.feed.show(undefined);
  await settle();
}

describe('what one Seen tells the subscribers', () => {
  it('tells the subscribers of History, the XP log, Progress and Badges once each when a Word is Seen', async () => {
    const opened = await run(5);
    const told = counting(opened.app);

    await see(opened, 0);

    expect(opened.app.history.list).toHaveLength(1);
    expect(opened.app.xpLog.state.today).toBe(1);
    expect(told).toEqual({ history: 1, xpLog: 1, progress: 1, badges: 1 });
  });

  it('tells them once each when the Seen meets the Daily Goal, with the goal met', async () => {
    const opened = await run(2);
    await see(opened, 0);
    const told = counting(opened.app);
    let metWhenTold: boolean | undefined;
    opened.app.xpLog.subscribe(() => {
      metWhenTold = opened.app.xpLog.state.dailyGoal?.met;
    });

    await see(opened, 1);

    expect(metWhenTold).toBe(true);
    expect(told).toEqual({ history: 1, xpLog: 1, progress: 1, badges: 1 });
  });

  it('tells them once each when a Word is Seen without a Daily Goal', async () => {
    const opened = await run(null);
    const told = counting(opened.app);

    await see(opened, 0);

    expect(opened.app.history.list).toHaveLength(1);
    expect(told).toEqual({ history: 1, xpLog: 1, progress: 1, badges: 1 });
  });

  // Ticket #2115: the Seen and its XP are one write, so a write that fails keeps neither.
  it('counts no Word Seen in Progress and the Daily Goal when the write of its XP fails', async () => {
    const memory = createMemoryUserStatePort(new Map());
    let failing = false;
    const opened = await run(5, {
      ...memory,
      write(changes) {
        const xp = [...changes.keys()].some((key) => key.startsWith('xp.'));
        return failing && xp ? Promise.reject(new Error('disk full')) : memory.write(changes);
      },
    });
    failing = true;
    const told = counting(opened.app);

    await see(opened, 0).catch(() => undefined);

    expect(opened.app.history.list).toEqual([]);
    expect(opened.app.xpLog.state.today).toBe(0);
    expect(opened.app.progress.state.seenToday).toBe(0);
    expect(opened.app.xpLog.state.dailyGoal?.seen).toBe(0);
    expect(told).toEqual({ history: 0, xpLog: 0, progress: 0, badges: 0 });

    failing = false;
    await see(opened, 0);

    expect(opened.app.xpLog.state.today).toBe(1);
    expect(opened.app.progress.state.seenToday).toBe(1);
    expect(opened.app.xpLog.state.dailyGoal?.seen).toBe(1);
  });
});
