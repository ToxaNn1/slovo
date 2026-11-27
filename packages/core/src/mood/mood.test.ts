import type { Mood } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { openComposition, type Clock, type FeatureSwitch } from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, settle, testEdition, word, analyticsInto } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const content = createMemoryContentPort({ words: [word('w_one'), word('w_two')] });

const MOODS: readonly Mood[] = [
  {
    id: 'energetic',
    name: 'Бадьорий',
    emoji: '⚡',
    reply: 'Тримай темп!',
    rarityBand: 'whole',
    shifts: {},
  },
  {
    id: 'thoughtful',
    name: 'Задумливий',
    emoji: '🤔',
    reply: 'Є над чим подумати.',
    rarityBand: 'whole',
    shifts: {},
  },
  {
    id: 'calm',
    name: 'Спокійний',
    emoji: '😌',
    reply: 'Без поспіху.',
    rarityBand: 'whole',
    shifts: {},
  },
  {
    id: 'joyful',
    name: 'Радісний',
    emoji: '😊',
    reply: 'Лови світле слово!',
    rarityBand: 'whole',
    shifts: {},
  },
];

/** Moods that say their effect on the Feed, the first with a rarity band. */
const EFFECT_MOODS: readonly Mood[] = [
  {
    id: 'energetic',
    name: 'Бадьорий',
    emoji: '⚡',
    reply: 'Тримай темп!',
    effect: 'Rarer words.',
    rarityBand: 'upper',
    shifts: {},
  },
  {
    id: 'calm',
    name: 'Спокійний',
    emoji: '😌',
    reply: 'Без поспіху.',
    effect: 'Simpler words.',
    rarityBand: 'whole',
    shifts: {},
  },
  {
    id: 'joyful',
    name: 'Радісний',
    emoji: '😊',
    reply: 'Лови світле слово!',
    effect: 'More idioms.',
    rarityBand: 'whole',
    shifts: {},
  },
];

/** The Core composition of one app run over the records, the Mood check-in on unless said otherwise. */
async function run({
  records = new Map<string, string>(),
  clock = fakeClock('2026-11-04T09:00:00+02:00').clock,
  on = ['wordOfTheDay', 'mood', 'analytics'],
  moods = MOODS,
  dashboardMoods = moods,
  analyticsFails = false,
}: {
  records?: Map<string, string>;
  /** The Edition's moods. */
  moods?: readonly Mood[];
  /** The moods the Dashboard offers, among all of `moods`. */
  dashboardMoods?: readonly Mood[];
  clock?: Clock;
  on?: FeatureSwitch[];
  /** Whether the Analytics port throws at each Mood event. */
  analyticsFails?: boolean;
} = {}) {
  const events: { event: string; properties: unknown }[] = [];
  const app = await openComposition({
    content,
    edition: testEdition({
      isFeatureEnabled: (feature) => on.includes(feature),
      moods,
      dashboardMoods,
      userSettingDefaults: { mix: { kinds: { correction: false } } },
    }),
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: { next: () => 0.25 },
    analytics: analyticsInto({
      // The Mood events alone: the onboarding tracks its welcome step on open.
      track: (event, properties) => {
        if (!event.startsWith('mood')) return;
        if (analyticsFails) throw new Error('analytics down');
        events.push({ event, properties });
      },
      stop: () => undefined,
    }),
  });
  return { app, records, events };
}

const moodBlock = (app: Awaited<ReturnType<typeof run>>['app']) =>
  app.dashboard.blocks.find((block) => block.kind === 'mood');

/** Resolves on the Dashboard's next change: it refreshes on its own after a Mood's tell. */
function dashboardChange(app: { dashboard: { subscribe(listener: () => void): unknown } }) {
  return new Promise<void>((resolve) => app.dashboard.subscribe(resolve));
}

describe('The Mood check-in', () => {
  it('asks on a day without a record, with the four moods of the Dashboard in order', async () => {
    const { app } = await run();

    expect(app.mood.today).toEqual({ state: 'asking' });
    expect(app.mood.moods.map(({ id }) => id)).toEqual([
      'energetic',
      'thoughtful',
      'calm',
      'joyful',
    ]);
    expect(moodBlock(app)).toMatchObject({ kind: 'mood', check: { state: 'asking' } });
  });

  it('keeps the chosen mood for the day and tells the subscribers', async () => {
    const { app, records, events } = await run();
    let told = 0;
    app.mood.subscribe(() => (told += 1));
    const dashboardTold = dashboardChange(app);

    await app.mood.choose('calm');
    await dashboardTold;

    expect(app.mood.today).toMatchObject({ state: 'chosen', mood: { id: 'calm' } });
    expect(moodBlock(app)).toMatchObject({ check: { state: 'chosen', mood: { id: 'calm' } } });
    expect(told).toBe(1);
    expect(JSON.parse(records.get('mood.2026-11-04') ?? '{}')).toEqual({
      date: '2026-11-04',
      choice: 'calm',
    });
    expect(events).toEqual([{ event: 'moodChosen', properties: { mood: 'calm' } }]);
  });

  it('shows the hero revealed after «Розкрити» while a change before it is still read', async () => {
    const port = createMemoryUserStatePort();
    // Holds the next read of the Word of the Day archive until released.
    let hold: Promise<void> | undefined;
    let release: () => void = () => undefined;
    const app = await openComposition({
      content,
      edition: testEdition({
        isFeatureEnabled: (feature) =>
          ['wordOfTheDay', 'wordOfTheDayArchive', 'previousWords', 'mood'].includes(feature),
        moods: MOODS,
        dashboardMoods: MOODS,
        userSettingDefaults: { mix: { kinds: { correction: false } } },
      }),
      userState: await openUserState({
        port: {
          ...port,
          async list(prefix) {
            const held = hold;
            hold = undefined;
            if (held !== undefined && prefix.startsWith('wordOfTheDayArchive')) await held;
            return port.list(prefix);
          },
        },
      }),
      clock: fakeClock('2026-11-04T09:00:00+02:00').clock,
      random: { next: () => 0.25 },
    });
    hold = new Promise<void>((resolve) => (release = resolve));

    await app.mood.choose('calm');
    const revealing = app.dashboard.reveal();
    await settle();
    release();
    await revealing;
    await settle();

    expect(app.dashboard.blocks[0]).toMatchObject({ hero: { state: 'revealed' } });
    expect(moodBlock(app)).toMatchObject({ check: { state: 'chosen', mood: { id: 'calm' } } });
  });

  it('skips the day, which hides the block till tomorrow', async () => {
    const { app, events } = await run();
    const dashboardTold = dashboardChange(app);

    await app.mood.skip();
    await dashboardTold;

    expect(app.mood.today).toEqual({ state: 'skipped' });
    expect(moodBlock(app)).toBeUndefined();
    expect(events).toEqual([{ event: 'moodSkipped', properties: {} }]);
  });

  it('keeps a choice and a skip when Analytics fails to track them', async () => {
    const chose = await run({ analyticsFails: true });
    const skipped = await run({ analyticsFails: true });

    await chose.app.mood.choose('calm');
    await skipped.app.mood.skip();

    expect(chose.app.mood.today).toMatchObject({ state: 'chosen', mood: { id: 'calm' } });
    expect(skipped.app.mood.today).toEqual({ state: 'skipped' });
  });

  it('changes the mood of the day', async () => {
    const { app } = await run();
    await app.mood.choose('calm');

    await app.mood.choose('joyful');

    expect(app.mood.today).toMatchObject({ state: 'chosen', mood: { id: 'joyful' } });
    expect(await app.mood.daysByMood()).toEqual(new Map([['joyful', 1]]));
  });

  it('ignores a mood the Dashboard does not list', async () => {
    const { app, events } = await run();

    await app.mood.choose('sad');

    expect(app.mood.today).toEqual({ state: 'asking' });
    expect(events).toEqual([]);
  });

  it('asks again when the day turns with the app left open over midnight', async () => {
    const time = fakeClock('2026-11-04T23:59:00+02:00');
    const { app } = await run({ clock: time.clock });
    await app.mood.choose('calm');

    time.advance(2 * 60 * 1000);
    await app.resume();

    expect(app.mood.today).toEqual({ state: 'asking' });
    expect(moodBlock(app)).toMatchObject({ check: { state: 'asking' } });
  });

  it('gives today’s Mood, and none once the day is over, before the day change reaches it', async () => {
    const time = fakeClock('2026-11-04T23:59:00+02:00');
    const { app } = await run({ clock: time.clock });
    expect(app.mood.today).toEqual({ state: 'asking' });
    await app.mood.choose('calm');
    expect(app.mood.today).toEqual({ state: 'chosen', mood: MOODS[2] });

    time.advance(2 * 60 * 1000);

    expect(app.mood.today).toEqual({ state: 'asking' });
  });

  it('reads a record synced from another device as the choice of the day', async () => {
    const records = new Map([
      ['mood.2026-11-04', JSON.stringify({ date: '2026-11-04', choice: 'energetic' })],
    ]);

    const { app } = await run({ records });

    expect(app.mood.today).toMatchObject({ state: 'chosen', mood: { id: 'energetic' } });
  });

  it('reads a saved Mood the Dashboard no longer offers as the choice of the day, and counts it', async () => {
    const records = new Map([
      ['mood.2026-11-03', JSON.stringify({ date: '2026-11-03', choice: 'joyful' })],
      ['mood.2026-11-04', JSON.stringify({ date: '2026-11-04', choice: 'joyful' })],
    ]);

    const { app } = await run({ records, dashboardMoods: MOODS.slice(0, 3) });

    expect(app.mood.moods.map(({ id }) => id)).toEqual(['energetic', 'thoughtful', 'calm']);
    expect(app.mood.today).toEqual({ state: 'chosen', mood: MOODS[3] });
    expect(moodBlock(app)).toMatchObject({ check: { state: 'chosen', mood: { id: 'joyful' } } });
    expect(await app.mood.daysByMood()).toEqual(new Map([['joyful', 2]]));
  });

  it('asks on a day whose saved Mood the Edition does not have, and counts that day for no Mood', async () => {
    const records = new Map([
      ['mood.2026-11-03', JSON.stringify({ date: '2026-11-03', choice: 'gloomy' })],
      ['mood.2026-11-04', JSON.stringify({ date: '2026-11-04', choice: 'gloomy' })],
    ]);

    const { app } = await run({ records });

    expect(app.mood.today).toEqual({ state: 'asking' });
    expect(await app.mood.daysByMood()).toEqual(new Map());
  });

  it('reads no saved Mood with `mood` off', async () => {
    const records = new Map([
      ['mood.2026-11-04', JSON.stringify({ date: '2026-11-04', choice: 'calm' })],
    ]);

    const { app } = await run({ records, on: ['wordOfTheDay'] });

    expect(app.mood.today).toEqual({ state: 'asking' });
    expect(app.mood.feedParameters().inBand).toBeUndefined();
  });

  it('tells no one when the same Mood is chosen again', async () => {
    const { app } = await run();
    await app.mood.choose('calm');
    let told = 0;
    app.mood.subscribe(() => (told += 1));

    await app.mood.choose('calm');

    expect(told).toBe(0);
  });

  it('tells the subscribers when the day turns over a chosen Mood', async () => {
    const time = fakeClock('2026-11-04T23:59:00+02:00');
    const { app } = await run({ clock: time.clock });
    await app.mood.choose('calm');
    let told = 0;
    app.mood.subscribe(() => (told += 1));

    time.advance(2 * 60 * 1000);
    await app.resume();
    await settle();

    expect(told).toBe(1);
  });

  it('ignores a choice of a Mood the Edition has but the Dashboard hides', async () => {
    const { app, events } = await run({ dashboardMoods: MOODS.slice(0, 3) });

    await app.mood.choose('joyful');

    expect(app.mood.today).toEqual({ state: 'asking' });
    expect(events).toEqual([]);
  });

  it('counts the days per mood for the statistics, skipped days for none', async () => {
    const records = new Map([
      ['mood.2026-11-01', JSON.stringify({ date: '2026-11-01', choice: 'calm' })],
      ['mood.2026-11-02', JSON.stringify({ date: '2026-11-02', choice: 'skipped' })],
      ['mood.2026-11-03', JSON.stringify({ date: '2026-11-03', choice: 'calm' })],
    ]);
    const { app } = await run({ records });
    await app.mood.choose('joyful');

    expect(await app.mood.daysByMood()).toEqual(
      new Map([
        ['calm', 2],
        ['joyful', 1],
      ]),
    );
  });

  it('says the effect of the chosen Mood in its block with `moodEffect` on', async () => {
    const { app } = await run({ on: ['mood', 'moodEffect'], moods: EFFECT_MOODS });
    const dashboardTold = dashboardChange(app);

    await app.mood.choose('energetic');
    await dashboardTold;

    expect(moodBlock(app)).toMatchObject({
      check: { state: 'chosen', mood: { id: 'energetic' }, effect: 'Rarer words.' },
    });
  });

  it('says no effect with `moodEffect` off', async () => {
    const { app } = await run({ on: ['mood'], moods: EFFECT_MOODS });
    const dashboardTold = dashboardChange(app);

    await app.mood.choose('energetic');
    await dashboardTold;

    expect(moodBlock(app)).toMatchObject({ check: { state: 'chosen', effect: undefined } });
  });

  it('unpicks the Mood of the day: no Mood today, the Feed on its plain parameters, the effect gone', async () => {
    const { app, records, events } = await run({
      on: ['mood', 'moodEffect', 'analytics'],
      moods: EFFECT_MOODS,
    });
    await app.mood.choose('energetic');
    expect(app.mood.feedParameters().inBand).toBeDefined();
    let told = 0;
    app.mood.subscribe(() => (told += 1));
    const dashboardTold = dashboardChange(app);

    await app.mood.unpick();
    await dashboardTold;

    expect(app.mood.today).toEqual({ state: 'asking' });
    expect(moodBlock(app)).toMatchObject({ check: { state: 'asking' } });
    expect(app.mood.feedParameters().inBand).toBeUndefined();
    expect(told).toBe(1);
    expect(await app.mood.daysByMood()).toEqual(new Map());
    // A record of the day stays, so the unpick wins on the reader's other devices.
    expect(JSON.parse(records.get('mood.2026-11-04') ?? '{}')).toEqual({
      date: '2026-11-04',
      choice: 'unpicked',
    });
    expect(events).toEqual([
      { event: 'moodChosen', properties: { mood: 'energetic' } },
      { event: 'moodUnpicked', properties: { mood: 'energetic' } },
    ]);
  });

  it('picks a Mood again after an unpick', async () => {
    const { app } = await run({ on: ['mood', 'moodEffect'], moods: EFFECT_MOODS });
    await app.mood.choose('energetic');
    await app.mood.unpick();

    await app.mood.choose('calm');

    expect(app.mood.today).toMatchObject({ state: 'chosen', mood: { id: 'calm' } });
  });

  it('keeps a skipped day skipped at an unpick', async () => {
    const { app } = await run({ on: ['mood', 'moodEffect'], moods: EFFECT_MOODS });
    await app.mood.skip();

    await app.mood.unpick();

    expect(app.mood.today).toEqual({ state: 'skipped' });
  });

  it('keeps the Mood of the day at an unpick with `moodEffect` off', async () => {
    const { app } = await run({ on: ['mood'], moods: EFFECT_MOODS });
    await app.mood.choose('energetic');

    await app.mood.unpick();

    expect(app.mood.today).toMatchObject({ state: 'chosen', mood: { id: 'energetic' } });
  });

  it('has no Mood block and asks nothing with `mood` off', async () => {
    const { app, records } = await run({ on: ['wordOfTheDay', 'analytics'] });

    await app.mood.choose('calm');

    expect(moodBlock(app)).toBeUndefined();
    expect(records.has('mood.2026-11-04')).toBe(false);
  });
});
