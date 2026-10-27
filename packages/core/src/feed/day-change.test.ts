import { describe, expect, it, vi } from 'vitest';

import {
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Clock,
  type Composition,
  type PlannedNotification,
  type UserStateChanges,
} from '../index';
import {
  createFakeNotificationScheduler,
  createMemoryContentPort,
  type FakeNotificationScheduler,
} from '../testing';
import { fakeClock, word } from '../test-support';

/** More Words than the plan holds, so every notification gets one. */
const words = Array.from({ length: 60 }, (_, index) => word(`w_${String(index).padStart(2, '0')}`));

/**
 * The Core composition of one app run over the records, with the fake
 * scheduler and every write it makes kept.
 */
async function run({
  clock,
  records = new Map<string, string>(),
  scheduler = createFakeNotificationScheduler(),
}: {
  clock: Clock;
  records?: Map<string, string>;
  scheduler?: FakeNotificationScheduler;
}) {
  const memory = createMemoryUserStatePort(records);
  const writes: UserStateChanges[] = [];
  const app: Composition = await openComposition({
    content: createMemoryContentPort({ words }),
    edition: {
      id: 'test',
      isFeatureEnabled: () => true,
      languageTraits: { distractorRule: 'same-part-of-speech' },
      userSettingDefaults: {
        mix: {
          categoryIds: ['test'],
          correctionCategoryIds: 'all' as const,
          corrections: false,
          idioms: true,
          synonymRows: true,
          tips: true,
        },
        notificationTimes: ['09:00', '19:00'],
      },
    },
    userState: await openUserState({
      port: {
        ...memory,
        write(changes) {
          writes.push(changes);
          return memory.write(changes);
        },
      },
    }),
    clock,
    random: { next: () => 0.25 },
    scheduling: { scheduler, ellipsis: '…', titles: ['{word}'], farewell: 'Farewell' },
  });
  return { app, records, writes, scheduler };
}

/** The last plan the scheduler was given; it fails the test when there is none. */
function planOf(scheduler: FakeNotificationScheduler): readonly PlannedNotification[] {
  if (scheduler.plan === undefined) throw new Error('Nothing was planned');
  return scheduler.plan;
}

/** The Word of a planned notification; it fails the test when the time has none. */
function wordAt(plan: readonly PlannedNotification[], slot: string): string {
  const wordId = plan.find(({ date, time }) => `${date}T${time}` === slot)?.wordId;
  if (wordId === undefined) throw new Error(`Nothing is planned at ${slot}`);
  return wordId;
}

/** The Active Days recorded, in date order. */
const activeDaysIn = (records: ReadonlyMap<string, string>) =>
  [...records.keys()]
    .filter((key) => key.startsWith('activeDays.'))
    .map((key) => key.slice('activeDays.'.length))
    .sort();

/** The Feed's cards as the ids of their Entries, with the day of a Word of the Day card. */
const cardsOf = ({ feed }: Composition) =>
  feed.cards.map((card) =>
    card.kind === 'word' && card.wordOfTheDay !== undefined
      ? `${card.entryId}@${String(card.wordOfTheDay.day)}`
      : card.entryId,
  );

describe('the day change', () => {
  it('records the first day as an Active Day and makes the plan when the app opens', async () => {
    const { app, records, scheduler } = await run({
      clock: fakeClock('2026-10-14T08:00:00+03:00').clock,
    });

    expect(activeDaysIn(records)).toEqual(['2026-10-14']);
    expect(app.progress.state.streak).toBe(1);
    expect(planOf(scheduler)).toHaveLength(30); // Two times up to the 14th day, the farewell last.
    // The Feed opens on today's Word of the Day, which the morning notification carries.
    expect(cardsOf(app)).toEqual([`${wordAt(planOf(scheduler), '2026-10-14T09:00')}@14`]);
  });

  it('turns to a new local day that starts while the app is open, in one call', async () => {
    const time = fakeClock('2026-10-14T23:50:00+03:00');
    const { app, records, scheduler } = await run({ clock: time.clock });
    const morning = wordAt(planOf(scheduler), '2026-10-15T09:00');
    // The reader is on the Word of the Day, with the next card ready.
    await app.feed.show(0);
    const before = cardsOf(app);

    time.set('2026-10-15T00:00:01+03:00');
    await app.resume();

    expect(activeDaysIn(records)).toEqual(['2026-10-14', '2026-10-15']);
    expect(app.progress.state.streak).toBe(2);
    // The card got ready the day before stays; the morning Word, the new
    // day's Word of the Day, comes after it once the reader swipes on.
    expect(cardsOf(app)).toEqual(before);
    await app.feed.show(1);
    expect(cardsOf(app)).toEqual([...before, `${morning}@15`]);
    // The plan is made again from the new day, its morning notification kept.
    expect(planOf(scheduler)[0]).toMatchObject({ date: '2026-10-15', time: '09:00' });
    expect(wordAt(planOf(scheduler), '2026-10-15T09:00')).toBe(morning);
  });

  it('turns to the new day once, however often the app comes back that day', async () => {
    const time = fakeClock('2026-10-14T23:50:00+03:00');
    const { app, writes, scheduler } = await run({ clock: time.clock });
    await app.feed.show(0);
    time.set('2026-10-15T00:00:01+03:00');
    await app.resume();
    const before = {
      writes: writes.length,
      cards: app.feed.cards,
      progress: app.progress.state,
      notifications: app.notifications.state,
      plan: planOf(scheduler),
    };

    time.set('2026-10-15T08:00:00+03:00');
    await app.resume();

    expect(writes).toHaveLength(before.writes);
    expect(app.feed.cards).toBe(before.cards);
    expect(app.progress.state).toBe(before.progress);
    expect(app.notifications.state).toBe(before.notifications);
    expect(planOf(scheduler)).toEqual(before.plan);
  });

  it('reads the permission again when the app comes back', async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const { app, scheduler } = await run({ clock: time.clock });

    // The reader turns notifications off in the iOS settings and comes back the same day.
    scheduler.setPermission('denied');
    time.set('2026-10-14T08:05:00+03:00');
    await app.resume();

    expect(app.notifications.state.permission).toBe('denied');
    expect(planOf(scheduler)).toEqual([]);
  });

  it("keeps a new day's morning Word when a plan is made before the composition turns to the day", async () => {
    const time = fakeClock('2026-10-14T20:00:00+03:00');
    const { app, scheduler } = await run({ clock: time.clock });
    const morning = wordAt(planOf(scheduler), '2026-10-15T09:00');

    // The app stays in the foreground into the next morning, with no report
    // yet, such as across a time-zone change; then a time change plans again.
    time.set('2026-10-15T10:00:00+03:00');
    await app.notifications.keepTime('21:00');
    await app.resume();
    await app.feed.show(0);

    expect(cardsOf(app).at(-1)).toBe(`${morning}@15`);
  });

  it("gives the card of a Word opened from a notification on a new day without waiting for the day's plan", async () => {
    const time = fakeClock('2026-10-14T08:00:00+03:00');
    const fake = createFakeNotificationScheduler();
    let hold = false;
    let held = 0;
    const scheduler: FakeNotificationScheduler = {
      ...fake,
      get plan() {
        return fake.plan;
      },
      replacePlan(plan) {
        if (!hold) return fake.replacePlan(plan);
        held += 1;
        return new Promise(() => undefined);
      },
    };
    const { app } = await run({ clock: time.clock, scheduler });
    const evening = wordAt(planOf(scheduler), '2026-10-14T19:00');
    // The evening notification has passed when the app comes back, so its Word is no longer Reserved.
    time.set('2026-10-14T20:00:00+03:00');
    await app.resume();

    // The next morning the reader taps it, and the device's scheduler hangs on the new day's plan.
    time.set('2026-10-15T09:05:00+03:00');
    hold = true;
    const card = await app.openedFromNotification(evening);

    expect(card?.entryId).toBe(evening);
    expect(app.history.list[0]?.entryId).toBe(evening);
    // The day's plan goes on after the card is given, and hangs there.
    await vi.waitFor(() => {
      expect(held).toBe(1);
    });
  });

  describe('with a notification tapped from the background on a new day', () => {
    /**
     * An app run that went to the background in the evening; the next
     * morning its notification is tapped, which brings the app back and
     * opens the Word at once. `bringBack` makes both calls.
     */
    async function tapNextMorning(
      bringBack: (app: Composition, morning: string) => Promise<unknown>,
    ) {
      const time = fakeClock('2026-10-14T20:00:00+03:00');
      const { app, records, writes, scheduler } = await run({ clock: time.clock });
      const morning = wordAt(planOf(scheduler), '2026-10-15T09:00');
      await app.feed.show(0);
      await app.feed.show(undefined);

      time.set('2026-10-15T09:05:00+03:00');
      const before = writes.length;
      await bringBack(app, morning);
      // The keys of each write the two calls made, in order.
      const madeWrites = writes.slice(before).map((changes) => [...changes.keys()].sort());
      await app.feed.show(0);
      return { app, records, scheduler, morning, madeWrites };
    }

    it("opens the morning Word as the new day's Word of the Day, with the day turned", async () => {
      const { app, records, morning } = await tapNextMorning((app, morning) =>
        Promise.all([app.resume(), app.openedFromNotification(morning)]),
      );

      expect(app.history.list.map(({ entryId, wordOfTheDay }) => [entryId, wordOfTheDay])).toEqual([
        [morning, true],
      ]);
      expect(activeDaysIn(records)).toEqual(['2026-10-14', '2026-10-15']);
      expect(cardsOf(app).at(-1)).toBe(`${morning}@15`);
    });

    it('ends the same whether the return or the tap comes first, or both at once', async () => {
      const outcome = ({
        app,
        records,
        scheduler,
      }: Awaited<ReturnType<typeof tapNextMorning>>) => ({
        records: new Map(records),
        cards: cardsOf(app),
        history: app.history.list,
        progress: app.progress.state,
        plan: planOf(scheduler),
      });
      const together = outcome(
        await tapNextMorning((app, morning) =>
          Promise.all([app.resume(), app.openedFromNotification(morning)]),
        ),
      );
      const tapFirst = outcome(
        await tapNextMorning(async (app, morning) => {
          await app.openedFromNotification(morning);
          await app.resume();
        }),
      );
      const returnFirst = outcome(
        await tapNextMorning(async (app, morning) => {
          await app.resume();
          await app.openedFromNotification(morning);
        }),
      );

      expect(together).toEqual(tapFirst);
      expect(together).toEqual(returnFirst);
    });

    it('runs the two at once one after the other, so today is written as an Active Day once', async () => {
      const { madeWrites: together } = await tapNextMorning((app, morning) =>
        Promise.all([app.resume(), app.openedFromNotification(morning)]),
      );
      const { madeWrites: oneAfterTheOther } = await tapNextMorning(async (app, morning) => {
        await app.resume();
        await app.openedFromNotification(morning);
      });

      expect(together).toEqual(oneAfterTheOther);
      expect(together.flat().filter((key) => key === 'activeDays.2026-10-15')).toHaveLength(1);
    });
  });
});
