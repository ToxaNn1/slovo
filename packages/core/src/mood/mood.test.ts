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

/** The Core composition of one app run over the records, the Mood check-in on unless said otherwise. */
async function run({
  records = new Map<string, string>(),
  clock = fakeClock('2026-11-04T09:00:00+02:00').clock,
  on = ['wordOfTheDay', 'dashboard', 'mood', 'analytics'],
  analyticsFails = false,
}: {
  records?: Map<string, string>;
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
      moods: MOODS,
      dashboardMoods: MOODS,
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

    await app.mood.choose('calm');

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
          ['wordOfTheDay', 'wordOfTheDayArchive', 'previousWords', 'dashboard', 'mood'].includes(
            feature,
          ),
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

    await app.mood.skip();

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

  it('has no Mood block and asks nothing with `mood` off', async () => {
    const { app, records } = await run({ on: ['wordOfTheDay', 'dashboard', 'analytics'] });

    await app.mood.choose('calm');

    expect(moodBlock(app)).toBeUndefined();
    expect(records.has('mood.2026-11-04')).toBe(false);
  });
});
