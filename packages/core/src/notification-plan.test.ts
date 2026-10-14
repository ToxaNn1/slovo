import { describe, expect, it } from 'vitest';

import type { Correction, Word } from '@slovo/contracts';

import {
  createFakeNotificationScheduler,
  createMemoryContentPort,
  createMemoryUserStatePort,
  NOTIFICATION_BODY_LENGTH,
  openComposition,
  openUserState,
  type Clock,
  type Composition,
  type FakeNotificationScheduler,
  type PlannedNotification,
} from './index';

function word(id: string, overrides: Partial<Word> = {}): Word {
  return {
    kind: 'word',
    id,
    lemma: id.slice(2),
    stress: [0],
    partOfSpeech: 'noun',
    primaryDefinition: `The meaning of ${id.slice(2)}.`,
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId: 'test',
    rarity: 3,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired: false,
    ...overrides,
  };
}

function correction(id: string): Correction {
  return {
    kind: 'correction',
    id,
    nonStandardForm: `not ${id.slice(2)}`,
    correctionType: 'calque',
    standardEquivalents: [id.slice(2)],
    explanation: 'An explanation.',
    examplePair: { nonStandard: 'People say this.', standard: 'Better say this.' },
    sources: [{ title: 'Test source' }],
    retired: false,
  };
}

/** A hundred Words of the Category in the Mix, more than the plan can hold. */
const manyWords = Array.from({ length: 100 }, (_, index) =>
  word(`w_${String(index).padStart(3, '0')}`),
);

/** A clock the test moves in time and to another time zone, as a reader who travels. */
function fakeClock(start = '2026-10-14T08:00:00+03:00', zone = 'Europe/Kyiv') {
  let now = new Date(start).getTime();
  let timeZone = zone;
  const clock: Clock = { now: () => new Date(now), timeZone: () => timeZone };
  return {
    clock,
    moveTo(instant: string) {
      now = new Date(instant).getTime();
    },
    travelTo(zone: string) {
      timeZone = zone;
    },
  };
}

const defaultTimes = ['09:00', '13:00', '19:00'];

/** The Core composition of one app run over the records, with a fake scheduler that records the plan. */
async function run({
  words = manyWords,
  corrections = [],
  records = new Map<string, string>(),
  clock = fakeClock().clock,
  scheduler = createFakeNotificationScheduler(),
  hasNotificationSound = true,
}: {
  words?: readonly Word[];
  corrections?: readonly Correction[];
  records?: Map<string, string>;
  clock?: Clock;
  scheduler?: FakeNotificationScheduler;
  hasNotificationSound?: boolean;
} = {}): Promise<{
  app: Composition;
  scheduler: FakeNotificationScheduler;
  records: Map<string, string>;
}> {
  const app = await openComposition({
    content: createMemoryContentPort({ words, corrections }),
    edition: {
      isFeatureEnabled: () => true,
      categories: [
        { id: 'test', displayName: 'Test' },
        { id: 'other', displayName: 'Other' },
      ],
      userSettingDefaults: {
        mix: { categoryIds: ['test'], corrections: true },
        notificationTimes: defaultTimes,
      },
      hasNotificationSound,
    },
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: { next: () => 0.25 },
    scheduling: { scheduler, ellipsis: '…' },
  });
  return { app, scheduler, records };
}

/** The last plan the scheduler was given; it fails the test when there is none. */
function planOf(scheduler: FakeNotificationScheduler): readonly PlannedNotification[] {
  if (scheduler.plan === undefined) throw new Error('Nothing was planned');
  return scheduler.plan;
}

/** Each planned notification as its local date and time, joined with a `T`. */
const slotsOf = (plan: readonly PlannedNotification[]) =>
  plan.map(({ date, time }) => `${date}T${time}`);

/** The Word of each planned notification, by its local date and time. */
const wordsBySlot = (plan: readonly PlannedNotification[]) =>
  new Map(
    plan.map((notification) => [`${notification.date}T${notification.time}`, notification.wordId]),
  );

/** The planned-notification records, by local date and time: the Reserved Words. */
function reservedOf(records: ReadonlyMap<string, string>): Map<string, string> {
  const prefix = 'notifications.plan.';
  return new Map(
    [...records]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), JSON.parse(value) as string]),
  );
}

/** The local dates from the first to the last, `YYYY-MM-DD`. */
function datesFrom(first: string, count: number): string[] {
  const start = new Date(`${first}T00:00:00Z`).getTime();
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
}

describe('the notification plan', () => {
  it("plans the Edition's default times for 14 days from the next time ahead", async () => {
    const { scheduler } = await run();

    const plan = planOf(scheduler);
    expect(plan).toHaveLength(42);
    expect(slotsOf(plan)).toEqual(
      datesFrom('2026-10-14', 14).flatMap((date) => defaultTimes.map((time) => `${date}T${time}`)),
    );
  });

  it('plans the stored times over the Edition defaults', async () => {
    const records = new Map([['notifications.times', JSON.stringify(['21:30', '07:15'])]]);

    const { scheduler } = await run({ records });

    const plan = planOf(scheduler);
    expect(plan).toHaveLength(28);
    expect(slotsOf(plan).slice(0, 3)).toEqual([
      '2026-10-14T21:30',
      '2026-10-15T07:15',
      '2026-10-15T21:30',
    ]);
    expect(slotsOf(plan).at(-1)).toBe('2026-10-28T07:15');
  });

  it('starts from the next time still ahead today, and reaches 14 days from it', async () => {
    const { scheduler } = await run({ clock: fakeClock('2026-10-14T10:00:00+03:00').clock });

    const slots = slotsOf(planOf(scheduler));
    expect(slots).toHaveLength(42);
    expect(slots[0]).toBe('2026-10-14T13:00');
    expect(slots.at(-1)).toBe('2026-10-28T09:00');
  });

  it('starts tomorrow once every time today has passed, and counts a time due this minute as passed', async () => {
    const { scheduler } = await run({ clock: fakeClock('2026-10-14T19:00:30+03:00').clock });

    const slots = slotsOf(planOf(scheduler));
    expect(slots[0]).toBe('2026-10-15T09:00');
    expect(slots.at(-1)).toBe('2026-10-28T19:00');
  });

  it('never plans more than 64 notifications', async () => {
    const tenTimes = Array.from({ length: 10 }, (_, index) => `${String(index + 10)}:00`);
    const records = new Map([['notifications.times', JSON.stringify(tenTimes)]]);

    const { scheduler } = await run({ records });

    const slots = slotsOf(planOf(scheduler));
    expect(slots).toHaveLength(64);
    expect(slots[0]).toBe('2026-10-14T10:00');
    expect(slots.at(-1)).toBe('2026-10-20T13:00');
  });

  it('keeps every local time and its Word after a time-zone change', async () => {
    const time = fakeClock();
    const { app, scheduler } = await run({ clock: time.clock });
    const before = wordsBySlot(planOf(scheduler));

    // A flight to New York: 08:00 there is 15:00 in Kyiv, when 09:00 and 13:00 have passed.
    time.travelTo('America/New_York');
    time.moveTo('2026-10-14T08:00:00-04:00');
    await app.resume();

    const plan = planOf(scheduler);
    expect(slotsOf(plan)).toEqual([...before.keys()]);
    expect(wordsBySlot(plan)).toEqual(before);
  });

  it('plans each eligible unseen Word once, and no Correction, Hidden, Retired, Seen or out-of-Mix Word', async () => {
    const records = new Map([
      ['hidden.w_hidden', JSON.stringify('2026-10-13T10:00:00.000Z')],
      ['feed.seen.w_seen', 'true'],
    ]);

    const { scheduler } = await run({
      words: [
        word('w_one'),
        word('w_two'),
        word('w_three'),
        word('w_hidden'),
        word('w_seen'),
        word('w_retired', { retired: true }),
        word('w_other', { categoryId: 'other' }),
      ],
      corrections: [correction('c_one')],
      records,
    });

    const plan = planOf(scheduler);
    // Too few unseen Words for every time: the earliest times get one each.
    expect(slotsOf(plan)).toEqual(['2026-10-14T09:00', '2026-10-14T13:00', '2026-10-14T19:00']);
    expect(plan.map(({ wordId }) => wordId).sort()).toEqual(['w_one', 'w_three', 'w_two']);
  });

  it('keeps the plan as the records of the Reserved Words, one per notification', async () => {
    const { scheduler, records } = await run();

    expect(reservedOf(records)).toEqual(wordsBySlot(planOf(scheduler)));
  });

  it('keeps the notifications still valid when it plans again, and gives a new time a new Word', async () => {
    const time = fakeClock();
    const records = new Map<string, string>();
    const { scheduler: first } = await run({ records, clock: time.clock });
    const before = wordsBySlot(planOf(first));

    // 09:00 passes; the next app run plans again over the same records.
    time.moveTo('2026-10-14T10:00:00+03:00');
    const { app, scheduler } = await run({ records, clock: time.clock });

    const kept = wordsBySlot(planOf(scheduler));
    expect(kept.size).toBe(42);
    for (const [slot, wordId] of kept) {
      if (slot !== '2026-10-28T09:00') expect([slot, wordId]).toEqual([slot, before.get(slot)]);
    }
    // The new last notification gets a Word no notification had, not the one that passed.
    expect([...before.values()]).not.toContain(kept.get('2026-10-28T09:00'));

    await app.notifications.addTime('11:00');

    const withNewTime = wordsBySlot(planOf(scheduler));
    expect(withNewTime.has('2026-10-14T11:00')).toBe(true);
    expect(new Set(withNewTime.values()).size).toBe(withNewTime.size);
    for (const [slot, wordId] of kept) expect(withNewTime.get(slot)).toBe(wordId);
  });

  it('plans again on every time change and on the sound switch', async () => {
    const { app, scheduler } = await run();

    await app.notifications.changeTime('13:00', '14:30');
    expect(planOf(scheduler)[1]).toMatchObject({ date: '2026-10-14', time: '14:30' });

    await app.notifications.removeTime('19:00');
    expect(planOf(scheduler)).toHaveLength(28);

    await app.notifications.setSound(false);
    expect(planOf(scheduler).every(({ sound }) => sound === 'silent')).toBe(true);
  });

  it('empties the plan and Reserves nothing once every time is removed', async () => {
    const { app, scheduler, records } = await run();

    for (const time of defaultTimes) await app.notifications.removeTime(time);

    expect(planOf(scheduler)).toEqual([]);
    expect(reservedOf(records).size).toBe(0);
  });

  it('plans nothing and Reserves nothing while permission is denied or not asked yet, and keeps the times', async () => {
    const records = new Map<string, string>();
    const scheduler = createFakeNotificationScheduler();
    const { app } = await run({ records, scheduler });
    expect(planOf(scheduler)).toHaveLength(42);

    scheduler.setPermission('denied');
    await app.resume();

    expect(planOf(scheduler)).toEqual([]);
    expect(reservedOf(records).size).toBe(0);
    expect(app.notifications.state.times).toEqual(defaultTimes);

    const notAsked = createFakeNotificationScheduler({ permission: 'not-asked' });
    await run({ records, scheduler: notAsked });
    expect(planOf(notAsked)).toEqual([]);
    expect(reservedOf(records).size).toBe(0);
  });

  it('plans once the reader allows notifications', async () => {
    const scheduler = createFakeNotificationScheduler({ permission: 'not-asked' });
    const { app } = await run({ scheduler });

    expect(await app.notifications.askPermission()).toBe('allowed');

    expect(planOf(scheduler)).toHaveLength(42);
  });

  it("plays the Edition's sound, the system sound without one, and none with the sound off", async () => {
    const records = new Map([['notifications.sound', 'false']]);

    const { scheduler: own } = await run();
    const { scheduler: system } = await run({ hasNotificationSound: false });
    const { scheduler: silent } = await run({ records });

    expect(new Set(planOf(own).map(({ sound }) => sound))).toEqual(new Set(['edition']));
    expect(new Set(planOf(system).map(({ sound }) => sound))).toEqual(new Set(['system']));
    expect(new Set(planOf(silent).map(({ sound }) => sound))).toEqual(new Set(['silent']));
  });

  it('titles a notification with the Lemma and its Stress, and gives the primary Definition as the body', async () => {
    const longDefinition =
      'Людина, яка вміє швидко зметикувати, що до чого, і знайти вихід навіть там, де інші розводять руками.';
    const { scheduler } = await run({
      words: [
        word('w_kebeta', {
          lemma: 'кебета',
          stress: [1],
          primaryDefinition: 'Кмітливість, тямущість.',
        }),
        word('w_dvi', { lemma: 'помилка', stress: [1, 3], primaryDefinition: 'Хибна дія.' }),
        word('w_dovge', { lemma: 'метикуватий', stress: [5], primaryDefinition: longDefinition }),
      ],
    });

    const byWord = new Map(
      planOf(scheduler).map((notification) => [notification.wordId, notification]),
    );
    expect(byWord.get('w_kebeta')).toMatchObject({
      title: 'ке́бета',
      body: 'Кмітливість, тямущість.',
    });
    expect(byWord.get('w_dvi')).toMatchObject({ title: 'по́ми́лка', body: 'Хибна дія.' });

    const long = byWord.get('w_dovge');
    expect(long?.title).toBe('метику́ватий');
    expect(long?.body).toBe(
      'Людина, яка вміє швидко зметикувати, що до чого, і знайти вихід навіть там, де…',
    );
    expect(Array.from(long?.body ?? '').length).toBeLessThanOrEqual(NOTIFICATION_BODY_LENGTH);
  });
});
