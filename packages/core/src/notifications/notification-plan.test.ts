import { describe, expect, it } from 'vitest';

import type { Correction, FeatureSwitch, Word } from '@slovo/contracts';

import {
  createMemoryUserStatePort,
  NOTIFICATION_BODY_LENGTH,
  openComposition,
  openUserState,
  type Clock,
  type Composition,
  type PlannedNotification,
} from '../index';
import {
  createFakeNotificationScheduler,
  createMemoryContentPort,
  type FakeNotificationScheduler,
} from '../testing';
import { correction, countingReads, fakeClock, word } from '../test-support';

/** The instant these tests start at. */
const start = '2026-10-14T08:00:00+03:00';

/** A hundred Words of the Category in the Mix, more than the plan can hold. */
const manyWords = Array.from({ length: 100 }, (_, index) =>
  word(`w_${String(index).padStart(3, '0')}`),
);

const defaultTimes = ['09:00', '13:00', '19:00'];

/** The Core composition of one app run over the records, with a fake scheduler that records the plan. */
async function run({
  words = manyWords,
  corrections = [],
  records = new Map<string, string>(),
  clock = fakeClock(start).clock,
  scheduler = createFakeNotificationScheduler(),
  notificationSound = 'notification.wav',
  mixCategoryIds = ['test'],
  switchedOff = [],
  titles = ['{word}'],
}: {
  words?: readonly Word[];
  corrections?: readonly Correction[];
  records?: Map<string, string>;
  clock?: Clock;
  scheduler?: FakeNotificationScheduler;
  /** The Edition's sound file; null for an Edition without one. */
  notificationSound?: string | null;
  mixCategoryIds?: readonly string[];
  /** The Feature Switches whose effective value is off. */
  switchedOff?: readonly FeatureSwitch[];
  /** The Edition's notification title templates. */
  titles?: readonly string[];
} = {}): Promise<{
  app: Composition;
  scheduler: FakeNotificationScheduler;
  records: Map<string, string>;
  /** How many reads of the pack the app made so far. */
  reads: () => number;
}> {
  const { content, reads } = countingReads(
    createMemoryContentPort({
      categories: [
        { id: 'test', displayName: 'Test' },
        { id: 'other', displayName: 'Other' },
      ],
      words,
      corrections,
    }),
  );
  const app = await openComposition({
    content,
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) => !switchedOff.includes(feature),
      languageTraits: { distractorRule: 'same-part-of-speech' },
      userSettingDefaults: {
        mix: {
          categoryIds: mixCategoryIds,
          correctionCategoryIds: 'all' as const,
          corrections: true,
          idioms: true,
          synonymRows: true,
          tips: true,
        },
        notificationTimes: defaultTimes,
      },
      notificationSound: notificationSound ?? undefined,
    },
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: { next: () => 0.25 },
    scheduling: { scheduler, ellipsis: '…', titles },
  });
  return { app, scheduler, records, reads };
}

/** Ten title templates, each telling its number before the Word. */
const titles = Array.from({ length: 10 }, (_, index) => `Шаблон ${String(index)}: {word}`);

/** The number of the template a title came from. */
const templateOf = (title: string | undefined) => title?.split(':')[0] ?? '';

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

  it('reads the planned Words together, however many it plans', async () => {
    /** How many reads of the pack planning again with the times takes. */
    async function readsToPlan(times: readonly string[]): Promise<number> {
      const records = new Map([['notifications.times', JSON.stringify(times)]]);
      const { app, scheduler, reads } = await run({ records });
      const before = reads();
      await app.resume();
      expect(planOf(scheduler)).toHaveLength(times.length === 1 ? 14 : 64);
      return reads() - before;
    }
    const tenTimes = Array.from({ length: 10 }, (_, index) => `${String(index + 10)}:00`);

    expect(await readsToPlan(tenTimes)).toBe(await readsToPlan(['10:00']));
  });

  it('keeps every local time and its Word after a time-zone change', async () => {
    const time = fakeClock(start);
    const { app, scheduler } = await run({ clock: time.clock });
    const before = wordsBySlot(planOf(scheduler));

    // A flight to New York: 08:00 there is 15:00 in Kyiv, when 09:00 and 13:00 have passed.
    time.moveTo('America/New_York');
    time.set('2026-10-14T08:00:00-04:00');
    await app.resume();

    const plan = planOf(scheduler);
    expect(slotsOf(plan)).toEqual([...before.keys()]);
    expect(wordsBySlot(plan)).toEqual(before);
  });

  it('plans each eligible unseen Word once, and no Correction, Hidden, Retired, Seen or out-of-Mix Word', async () => {
    const records = new Map([
      ['hidden.w_hidden', JSON.stringify('2026-10-13T10:00:00.000Z')],
      ['feed.seen.w_seen', '1'],
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

  it('keeps the notifications still valid when it plans again, and gives a new time a new Word', async () => {
    const time = fakeClock(start);
    const records = new Map<string, string>();
    const { scheduler: first } = await run({ records, clock: time.clock });
    const before = wordsBySlot(planOf(first));

    // 09:00 passes; the next app run plans again over the same records.
    time.set('2026-10-14T10:00:00+03:00');
    const { app, scheduler } = await run({ records, clock: time.clock });

    const kept = wordsBySlot(planOf(scheduler));
    expect(kept.size).toBe(42);
    for (const [slot, wordId] of kept) {
      if (slot !== '2026-10-28T09:00') expect([slot, wordId]).toEqual([slot, before.get(slot)]);
    }
    // The new last notification gets a Word no notification had, not the one that passed.
    expect([...before.values()]).not.toContain(kept.get('2026-10-28T09:00'));

    await app.notifications.keepTime('11:00');

    const withNewTime = wordsBySlot(planOf(scheduler));
    expect(withNewTime.has('2026-10-14T11:00')).toBe(true);
    expect(new Set(withNewTime.values()).size).toBe(withNewTime.size);
    for (const [slot, wordId] of kept) expect(withNewTime.get(slot)).toBe(wordId);
  });

  it('plans again on every time change and on the sound switch', async () => {
    const { app, scheduler } = await run();

    await app.notifications.keepTime('14:30', '13:00');
    expect(planOf(scheduler)[1]).toMatchObject({ date: '2026-10-14', time: '14:30' });

    await app.notifications.removeTime('19:00');
    expect(planOf(scheduler)).toHaveLength(28);

    await app.notifications.setSound(false);
    expect(planOf(scheduler).every(({ sound }) => sound === 'silent')).toBe(true);
  });

  it('empties the plan and Reserves nothing once every time is removed', async () => {
    const time = fakeClock(start);
    const { app, scheduler } = await run({ clock: time.clock });

    for (const kept of defaultTimes) await app.notifications.removeTime(kept);

    expect(planOf(scheduler)).toEqual([]);
    await expectNothingReserved(app, scheduler, time);
  });

  it('plans nothing and Reserves nothing while permission is denied or not asked yet, and keeps the times', async () => {
    const time = fakeClock(start);
    const scheduler = createFakeNotificationScheduler();
    const { app } = await run({ clock: time.clock, scheduler });
    expect(planOf(scheduler)).toHaveLength(42);

    scheduler.setPermission('denied');
    await app.resume();

    expect(planOf(scheduler)).toEqual([]);
    expect(app.notifications.state.times).toEqual(defaultTimes);
    await expectNothingReserved(app, scheduler, time);

    // A plan made while allowed, then a run with permission not asked yet.
    const records = new Map<string, string>();
    await run({ records, clock: time.clock });
    const notAsked = createFakeNotificationScheduler({ permission: 'not-asked' });
    const { app: unasked } = await run({ records, clock: time.clock, scheduler: notAsked });
    expect(planOf(notAsked)).toEqual([]);
    await expectNothingReserved(unasked, notAsked, time);
  });

  it('plans once the reader allows notifications', async () => {
    const scheduler = createFakeNotificationScheduler({ permission: 'not-asked' });
    const { app } = await run({ scheduler });

    expect(await app.notifications.askPermission()).toBe('allowed');

    expect(planOf(scheduler)).toHaveLength(42);
  });

  it('reports the permission in the state, and tells the subscribers when it changes', async () => {
    const scheduler = createFakeNotificationScheduler({ permission: 'not-asked' });
    const { app } = await run({ scheduler });
    expect(app.notifications.state.permission).toBe('not-asked');
    let told = 0;
    app.notifications.subscribe(() => {
      told += 1;
    });

    await app.notifications.askPermission();
    expect(app.notifications.state.permission).toBe('allowed');
    expect(told).toBe(1);

    // The reader turns notifications off in the iOS settings and comes back.
    scheduler.setPermission('denied');
    await app.resume();
    expect(app.notifications.state.permission).toBe('denied');
    expect(told).toBe(2);

    const before = app.notifications.state;
    await app.resume();
    expect(app.notifications.state).toBe(before);
    expect(told).toBe(2);
  });

  it("plays the Edition's sound, the system sound without one, and none with the sound off", async () => {
    const records = new Map([['notifications.sound', 'false']]);

    const { scheduler: own } = await run();
    const { scheduler: system } = await run({ notificationSound: null });
    const { scheduler: silent } = await run({ records });

    const soundsOf = (scheduler: FakeNotificationScheduler) =>
      planOf(scheduler).map(({ sound }) => sound);
    const all = <T>(sound: T) => soundsOf(own).map(() => sound);
    expect(soundsOf(own)).toEqual(all({ file: 'notification.wav' }));
    expect(soundsOf(system)).toEqual(all('system'));
    expect(soundsOf(silent)).toEqual(all('silent'));
  });

  it("titles each notification from the Edition's templates, never the one just before, and keeps the body", async () => {
    // The injected randomness lands on the same template at every draw.
    const words = Array.from({ length: 20 }, (_, index) =>
      word(`w_${String(index).padStart(2, '0')}`, {
        lemma: 'слово',
        stress: [2],
        primaryDefinition: `Значення ${String(index)}.`,
      }),
    );

    const { scheduler } = await run({ words, titles });

    const plan = planOf(scheduler);
    expect(plan).toHaveLength(20);
    const used = plan.map(({ title }) => templateOf(title));
    expect(plan.map(({ title }) => title)).toEqual(used.map((template) => `${template}: сло́во`));
    expect(used.every((template) => titles.some((title) => title.startsWith(`${template}:`)))).toBe(
      true,
    );
    expect(used.slice(1).every((template, index) => template !== used[index])).toBe(true);
    expect(plan.map(({ body }) => body)).toEqual(
      plan.map(({ wordId }) => words.find(({ id }) => id === wordId)?.primaryDefinition),
    );
  });

  it('never opens a new plan with the template of the notification that came last', async () => {
    const time = fakeClock(start);
    const records = new Map([['notifications.times', JSON.stringify(['09:00'])]]);
    const { scheduler } = await run({ records, clock: time.clock, titles });
    const nineToday = planOf(scheduler).find(({ date }) => date === '2026-10-14');

    // The 09:00 notification has come; the next run moves the time to 10:00.
    time.set('2026-10-14T09:30:00+03:00');
    const { app, scheduler: later } = await run({ records, clock: time.clock, titles });
    await app.notifications.keepTime('10:00', '09:00');

    const [next] = planOf(later);
    expect(next).toMatchObject({ date: '2026-10-14', time: '10:00' });
    expect(templateOf(next?.title)).not.toBe(templateOf(nineToday?.title));
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

  it.each([
    ['an Arabic comma', '،'],
    ['an Armenian full stop', '։'],
    ['a Devanagari danda', '।'],
    ['an ideographic full stop', '。'],
    ['a Greek ano teleia', '\u0387'],
  ])('drops %s before the ellipsis of a cut body, as any punctuation', async (_, mark) => {
    const head = 'Слово, що його вживають лише в давніх текстах і майже ніколи в живій мові';
    const { scheduler } = await run({
      words: [word('w_long', { primaryDefinition: `${head}${mark} сьогоднішнього дня.` })],
    });

    expect(planOf(scheduler)[0]?.body).toBe(`${head}…`);
  });

  it.each([
    ['a question mark', '?'],
    ['an exclamation mark', '!'],
    ['a percent sign', '%'],
    ['a quotation mark', '"'],
    ['an apostrophe', "'"],
  ])('keeps %s before the ellipsis, since it says something', async (_, mark) => {
    const head = 'Слово, що його вживають лише в давніх текстах і майже ніколи в живій мові';
    const { scheduler } = await run({
      words: [word('w_long', { primaryDefinition: `${head}${mark} сьогоднішнього дня.` })],
    });

    expect(planOf(scheduler)[0]?.body).toBe(`${head}${mark}…`);
  });
});

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** The Word on each Word of the Day card of the Feed, by its local date `YYYY-MM-DD`. */
function wordsOfTheDayIn({ feed }: Composition): Map<string, string> {
  return new Map(
    feed.cards.flatMap((card) => {
      if (card.kind !== 'word' || card.wordOfTheDay === undefined) return [];
      const { year, month, day } = card.wordOfTheDay;
      const date = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
      return [[date, card.entryId]];
    }),
  );
}

/**
 * Shows the Feed's cards up to `position`, each long enough to be Seen once
 * it leaves the screen: every card before `position` is Seen.
 */
async function readTo(
  app: Composition,
  time: ReturnType<typeof fakeClock>,
  position: number,
): Promise<void> {
  for (let page = 0; page <= position; page += 1) {
    await app.feed.show(page);
    time.advance(2 * SECOND);
  }
}

/**
 * Expects the plan to Reserve no Word: reading the Feed's first five cards,
 * the Words a plan made this morning gives its first notifications, plans
 * nothing again.
 */
async function expectNothingReserved(
  app: Composition,
  scheduler: FakeNotificationScheduler,
  time: ReturnType<typeof fakeClock>,
): Promise<void> {
  const plan = scheduler.plan;
  await readTo(app, time, 5);
  expect(scheduler.plan).toBe(plan);
}

/** The Word of a planned notification; it fails the test when the time has none. */
function wordAt(plan: readonly PlannedNotification[], slot: string): string {
  const wordId = wordsBySlot(plan).get(slot);
  if (wordId === undefined) throw new Error(`Nothing is planned at ${slot}`);
  return wordId;
}

describe('the Feature Switches of notifications and the Word of the Day', () => {
  it('plans nothing and Reserves nothing with notifications switched off, and keeps the times', async () => {
    const time = fakeClock(start);
    const { app, scheduler } = await run({ clock: time.clock, switchedOff: ['notifications'] });

    expect(planOf(scheduler)).toEqual([]);
    expect(app.notifications.state.times).toEqual(defaultTimes);
    await expectNothingReserved(app, scheduler, time);
  });

  it('plans nothing on a change of the times or the sound with notifications switched off', async () => {
    const { app, scheduler } = await run({ switchedOff: ['notifications'] });

    await app.notifications.keepTime('21:00');
    await app.notifications.setSound(false);

    expect(planOf(scheduler)).toEqual([]);
  });

  it('plans again, from the times kept, once notifications are switched on', async () => {
    const records = new Map<string, string>();
    await run({ records, switchedOff: ['notifications'] });

    const { scheduler } = await run({ records });

    expect(planOf(scheduler)).toHaveLength(42);
  });

  it('plans as before with both switches on', async () => {
    const { scheduler } = await run({ switchedOff: [] });

    expect(planOf(scheduler)).toHaveLength(42);
  });

  it("keeps today's Word of the Day for no notification with it switched on, and plans it like any Word with it off", async () => {
    // Three Words and a morning already passed: the Word of the Day has no notification left to take it.
    const clock = fakeClock('2026-10-14T10:00:00+03:00').clock;
    const words = manyWords.slice(0, 3);
    const on = await run({ words, clock });
    const off = await run({ words, clock, switchedOff: ['wordOfTheDay'] });

    expect(planOf(on.scheduler)).toHaveLength(2);
    expect(planOf(off.scheduler)).toHaveLength(3);
  });
});

describe('the plan following the Feed', () => {
  it('gives the earliest time today the Word of the Day, and no other notification', async () => {
    const { app, scheduler } = await run();

    const today = wordsOfTheDayIn(app).get('2026-10-14');
    const plan = planOf(scheduler);
    expect(today).toBeDefined();
    expect(wordAt(plan, '2026-10-14T09:00')).toBe(today);
    expect(plan.filter(({ wordId }) => wordId === today)).toHaveLength(1);
  });

  it("makes a later day's morning notification that day's Word of the Day when the day comes", async () => {
    const time = fakeClock(start);
    const records = new Map<string, string>();
    const { app, scheduler } = await run({ records, clock: time.clock });
    const before = planOf(scheduler);
    await app.feed.show(0);

    // The app stays open over midnight.
    time.set('2026-10-15T00:00:05+03:00');
    await app.resume();
    await app.feed.show(0);

    const tomorrow = wordAt(before, '2026-10-15T09:00');
    expect(wordsOfTheDayIn(app).get('2026-10-15')).toBe(tomorrow);
    expect(wordAt(planOf(scheduler), '2026-10-15T09:00')).toBe(tomorrow);

    // The next run starts after that day's morning notification has passed.
    time.set('2026-10-16T10:00:00+03:00');
    const { app: later } = await run({ records, clock: time.clock });

    expect(wordsOfTheDayIn(later).get('2026-10-16')).toBe(wordAt(before, '2026-10-16T09:00'));
  });

  it('makes the Word of the earliest time planned on a later day its Word of the Day', async () => {
    const time = fakeClock(start);
    const records = new Map<string, string>();
    const { app, scheduler } = await run({ records, clock: time.clock });
    const nine = wordAt(planOf(scheduler), '2026-10-15T09:00');

    // An earlier time added ahead of the 09:00 notification, which keeps its Word.
    await app.notifications.keepTime('07:15');
    const plan = planOf(scheduler);
    expect(wordAt(plan, '2026-10-15T09:00')).toBe(nine);

    time.set('2026-10-15T10:00:00+03:00');
    const { app: later } = await run({ records, clock: time.clock });

    expect(wordsOfTheDayIn(later).get('2026-10-15')).toBe(wordAt(plan, '2026-10-15T07:15'));
  });

  it('takes the morning Word of the local day a new time zone has reached', async () => {
    // 20:00 in Kyiv is 02:00 the next day in Tokyo.
    const time = fakeClock('2026-10-14T20:00:00+03:00');
    const records = new Map<string, string>();
    const { scheduler } = await run({ records, clock: time.clock });
    const tomorrow = wordAt(planOf(scheduler), '2026-10-15T09:00');

    time.moveTo('Asia/Tokyo');
    const { app } = await run({ records, clock: time.clock });

    expect(wordsOfTheDayIn(app).get('2026-10-15')).toBe(tomorrow);
  });

  it("makes the Word of the morning notification opened on a new day that day's Word of the Day", async () => {
    const time = fakeClock('2026-10-14T20:00:00+03:00');
    const { app, scheduler } = await run({ clock: time.clock });
    const morning = wordAt(planOf(scheduler), '2026-10-15T09:00');
    await app.feed.show(0);
    await app.feed.show(undefined);

    // The app sat in the background overnight; the morning notification opens it.
    time.set('2026-10-15T09:05:00+03:00');
    await app.openedFromNotification(morning);
    await app.resume();
    await app.feed.show(0);

    expect(app.history.list[0]).toMatchObject({ entryId: morning, wordOfTheDay: true });
    expect(wordsOfTheDayIn(app).get('2026-10-15')).toBe(morning);
  });

  it('gives a new Word to the notification of a Reserved Word hidden, and keeps the others', async () => {
    const time = fakeClock(start);
    const records = new Map<string, string>();
    const { app, scheduler } = await run({ records, clock: time.clock });
    const before = wordsBySlot(planOf(scheduler));
    const hidden = [
      wordAt(planOf(scheduler), '2026-10-16T13:00'),
      wordAt(planOf(scheduler), '2026-10-17T09:00'),
    ];

    for (const entryId of hidden) await app.hide({ kind: 'entry', entryId });

    const after = wordsBySlot(planOf(scheduler));
    expect(after.size).toBe(42);
    for (const [slot, wordId] of before) {
      if (hidden.includes(wordId)) expect(after.get(slot)).not.toBe(wordId);
      else expect([slot, after.get(slot)]).toEqual([slot, wordId]);
    }
    expect([...after.values()].filter((wordId) => hidden.includes(wordId))).toEqual([]);

    // The new morning Word is the Word of the Day when its day comes.
    time.set('2026-10-17T08:00:00+03:00');
    const { app: later } = await run({ records, clock: time.clock });
    expect(wordsOfTheDayIn(later).get('2026-10-17')).toBe(after.get('2026-10-17T09:00'));
  });

  it('gives new Words to the notifications of a Category taken out of the Mix', async () => {
    const others = Array.from({ length: 30 }, (_, index) =>
      word(`w_other_${String(index).padStart(2, '0')}`, { categoryId: 'other' }),
    );
    const { app, scheduler } = await run({
      words: [...manyWords, ...others],
      mixCategoryIds: ['test', 'other'],
    });
    const before = wordsBySlot(planOf(scheduler));
    const isOther = (wordId: string) => wordId.startsWith('w_other_');
    expect([...before.values()].some(isOther)).toBe(true);

    await app.mix.takeOut('other');

    const after = wordsBySlot(planOf(scheduler));
    expect(after.size).toBe(42);
    expect([...after.values()].filter(isOther)).toEqual([]);
    for (const [slot, wordId] of before) {
      if (!isOther(wordId)) expect([slot, after.get(slot)]).toEqual([slot, wordId]);
    }
  });

  it('fills its notifications again once a Word is unhidden or its Category put back in the Mix', async () => {
    const words = [
      word('w_one'),
      word('w_two'),
      word('w_three', { categoryId: 'other' }),
      word('w_four', { categoryId: 'other' }),
    ];
    const { app, scheduler } = await run({ words, mixCategoryIds: ['test', 'other'] });
    expect(planOf(scheduler)).toHaveLength(4);

    await app.hide({ kind: 'entry', entryId: 'w_one' });
    await app.mix.takeOut('other');
    expect(planOf(scheduler).map(({ wordId }) => wordId)).toEqual(['w_two']);

    await app.unhide({ kind: 'entry', entryId: 'w_one' });
    await app.mix.putBack('other');

    const wordIds = planOf(scheduler).map(({ wordId }) => wordId);
    expect(wordIds.sort()).toEqual(['w_four', 'w_one', 'w_three', 'w_two']);
  });

  it('gives a new Word to the notification of a Reserved Word Seen in the Feed, and keeps the others', async () => {
    const time = fakeClock(start);
    const { app, scheduler } = await run({ clock: time.clock });
    const before = wordsBySlot(planOf(scheduler));

    // The reader reads the Word of the Day and the card after it.
    await readTo(app, time, 2);

    const seen = [app.feed.cards[0]?.entryId, app.feed.cards[1]?.entryId];
    expect(before.get('2026-10-14T09:00')).toBe(seen[0]);
    expect([...before.values()]).toContain(seen[1]);
    const after = wordsBySlot(planOf(scheduler));
    expect(after.size).toBe(42);
    for (const [slot, wordId] of before) {
      if (seen.includes(wordId)) expect(after.get(slot)).not.toBe(wordId);
      else expect([slot, after.get(slot)]).toEqual([slot, wordId]);
    }
    expect([...after.values()].filter((wordId) => seen.includes(wordId))).toEqual([]);
  });

  it('plans nothing again when the Feed makes Seen a Word no notification Reserved', async () => {
    // Every time today has passed, so today's Word of the Day goes to no notification.
    const time = fakeClock('2026-10-14T20:00:00+03:00');
    const { app, scheduler } = await run({ clock: time.clock });
    const before = planOf(scheduler);
    const today = wordsOfTheDayIn(app).get('2026-10-14');
    expect(before.map(({ wordId }) => wordId)).not.toContain(today);

    await readTo(app, time, 1);

    expect(app.feed.cards[0]?.entryId).toBe(today);
    expect(app.history.list[0]?.entryId).toBe(today);
    expect(scheduler.plan).toBe(before);
  });

  it('keeps every notification still valid when it plans again, the mornings too', async () => {
    const time = fakeClock(start);
    const { app, scheduler } = await run({ clock: time.clock });
    const before = wordsBySlot(planOf(scheduler));

    time.advance(30 * MINUTE);
    await app.resume();
    await app.notifications.setSound(false);

    expect(wordsBySlot(planOf(scheduler))).toEqual(before);
  });

  it('fills what it can near the end of the Cycle, and never starts a new Cycle', async () => {
    const time = fakeClock(start);
    const records = new Map([
      ['feed.seen.w_a', '1'],
      ['feed.seen.w_b', '1'],
    ]);
    const words = ['w_a', 'w_b', 'w_c', 'w_d', 'w_e'].map((id) => word(id));
    const { app, scheduler } = await run({ words, records, clock: time.clock });
    const cycle = records.get('feed.cycle');

    const plan = planOf(scheduler);
    expect(slotsOf(plan)).toEqual(['2026-10-14T09:00', '2026-10-14T13:00', '2026-10-14T19:00']);
    expect(wordAt(plan, '2026-10-14T09:00')).toBe(wordsOfTheDayIn(app).get('2026-10-14'));

    // The reader reads the last unseen Words in the Feed.
    await readTo(app, time, 2);
    await app.feed.show(undefined);

    expect(planOf(scheduler)).toEqual([]);
    expect(records.get('feed.cycle')).toBe(cycle);
  });
});

describe('the Reserved Words', () => {
  it("keep each notification's Word for the next app run, also a Word given out of the Cycle's order", async () => {
    const records = new Map<string, string>();
    const { app, scheduler } = await run({ records });
    const before = planOf(scheduler);
    await app.hide({ kind: 'entry', entryId: wordAt(before, '2026-10-16T13:00') });
    const after = planOf(scheduler);
    // The notification after it keeps its Word, so the plan no longer follows the Cycle's order.
    expect(wordAt(after, '2026-10-16T19:00')).toBe(wordAt(before, '2026-10-16T19:00'));

    const { scheduler: next } = await run({ records });

    expect(planOf(next)).toEqual(after);
  });

  it("are replaced whole: a removed time's Word is no longer its day's morning Word", async () => {
    const time = fakeClock(start);
    const records = new Map<string, string>();
    const { app, scheduler } = await run({ records, clock: time.clock });
    const nine = wordAt(planOf(scheduler), '2026-10-15T09:00');
    const one = wordAt(planOf(scheduler), '2026-10-15T13:00');

    await app.notifications.removeTime('09:00');
    expect(wordAt(planOf(scheduler), '2026-10-15T13:00')).toBe(one);

    time.set('2026-10-15T14:00:00+03:00');
    const { app: later } = await run({ records, clock: time.clock });

    expect(nine).not.toBe(one);
    expect(wordsOfTheDayIn(later).get('2026-10-15')).toBe(one);
  });

  it("give no Word of the Day a morning Word Seen, out of the Cycle or the day before's Word of the Day", async () => {
    const time = fakeClock('2026-10-14T20:00:00+03:00');
    const records = new Map<string, string>();
    const { scheduler } = await run({ records, clock: time.clock });
    const morning = wordAt(planOf(scheduler), '2026-10-15T09:00');

    time.set('2026-10-15T10:00:00+03:00');
    const seen = await run({
      records: new Map([...records, [`feed.seen.${morning}`, '1']]),
      clock: time.clock,
    });
    const outOfCycle = await run({
      records: new Map(records),
      clock: time.clock,
      words: manyWords.filter(({ id }) => id !== morning),
    });
    const dayBefore = await run({
      records: new Map([
        ...records,
        ['feed.wordOfTheDay', JSON.stringify({ entryId: morning, date: '2026-10-14' })],
      ]),
      clock: time.clock,
    });

    for (const { app } of [seen, outOfCycle, dayBefore]) {
      const today = wordsOfTheDayIn(app).get('2026-10-15');
      expect(today).toBeDefined();
      expect(today).not.toBe(morning);
    }
  });
});
