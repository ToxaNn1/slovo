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
import { fakeClock, testEdition, word, wordIdOf } from './test-support';

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
    edition: testEdition({
      isFeatureEnabled: () => true,
      userSettingDefaults: { notificationTimes: ['09:00', '13:00', '19:00'] },
    }),
    userState: await openUserState({ port }),
    clock: time.clock,
    random: { next: () => 0.25 },
    scheduling: {
      scheduler,
      ellipsis: '…',
      titles: ['{word}'],
      farewell: 'Farewell',
      streakWarning: 'Streak warning',
      goalNotMet: 'Goal not met',
    },
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

describe('a hidden Entry', () => {
  it('leaves the Feed, the notification plan and the Game Modes on offer at once', async () => {
    const { app, scheduler } = await run();
    await app.feed.show(0);
    const next = app.feed.cards[1]?.entryId;
    if (next === undefined) throw new Error('No card is ready after the Word of the Day');
    const guessWord = () => app.game.state.modes.find(({ modeId }) => modeId === 'guess-word');
    await vi.waitFor(() => {
      expect(guessWord()).toMatchObject({ canStart: true });
    });
    expect(scheduler.plan?.map(wordIdOf)).toContain(next);

    // Six of the twenty Words hidden leave fewer than the 15 a Game needs.
    const shown = new Set(app.feed.cards.map((card) => card.entryId));
    const others = Array.from({ length: 20 }, (_, index) => `w_${String(index).padStart(2, '0')}`)
      .filter((id) => !shown.has(id))
      .slice(0, 5);
    for (const entryId of [next, ...others]) await app.hide({ kind: 'entry', entryId });

    expect(app.feed.cards.map((card) => card.entryId)).not.toContain(next);
    expect(scheduler.plan?.map(wordIdOf)).not.toContain(next);
    expect(guessWord()).toMatchObject({ canStart: false, refusal: 'too-few-entries' });
  });
});

describe('an Entry opened by id', () => {
  /** A pack with a Word, a Synonym Row that links it as a member and a Tip. */
  const withRowAndTip = createMemoryContentPort({
    categories: [{ id: 'test', displayName: 'Test' }],
    words: [word('w_ity'), word('w_prostuvaty')],
    synonymRows: [
      {
        kind: 'synonymRow',
        id: 'r_ity',
        dominant: { text: 'іти', stress: [2], wordId: 'w_ity' },
        meaning: 'Рухатися пішки.',
        members: [
          { text: 'простувати', stress: [7], wordId: 'w_prostuvaty' },
          { text: 'чимчикувати', stress: [4] },
          { text: 'шкандибати', stress: [7] },
          { text: 'дибати', stress: [1] },
          { text: 'чалапати', stress: [3] },
        ],
        sources: [{ title: 'Test source' }],
        retired: false,
      },
    ],
    tips: [
      {
        kind: 'tip',
        id: 't_kotrahodyna',
        title: 'Котра година?',
        nonStandardForm: 'Скільки час?',
        standardForm: 'Котра година?',
        explanation: 'Про час питають «котра година».',
        sources: [{ title: 'Test source' }],
        gameQuestion: {
          prompt: 'Як запитати про час?',
          rightAnswer: 'Котра година?',
          wrongAnswers: ['Скільки час?', 'Скільки годин?', 'Який час?'],
        },
        retired: false,
      },
    ],
  });

  it('opens the Synonym Row a Word card links back to, as its Feed card shows it', async () => {
    const { app } = await run({ pack: withRowAndTip });

    const wordCard = await app.entryCard('w_prostuvaty');
    const rowId = wordCard?.kind === 'word' ? wordCard.model.synonymRow?.synonymRowId : undefined;

    expect(rowId).toBe('r_ity');
    expect(await app.entryCard(rowId ?? '')).toMatchObject({
      kind: 'synonymRow',
      entryId: 'r_ity',
      model: { synonymRowId: 'r_ity', dominant: { text: 'іти́', wordId: 'w_ity' } },
    });
  });

  it('opens a Tip by its id', async () => {
    const { app } = await run({ pack: withRowAndTip });

    expect(await app.entryCard('t_kotrahodyna')).toMatchObject({
      kind: 'tip',
      entryId: 't_kotrahodyna',
    });
  });
});
