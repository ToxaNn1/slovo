import { describe, expect, it } from 'vitest';

import {
  createMemoryContentPort,
  createMemoryUserStatePort,
  openComposition,
  openUserState,
  type Clock,
  type Composition,
  type FeatureSwitch,
} from '../index';
import { correction, fakeClock, word } from '../test-support';

const content = createMemoryContentPort({
  words: [word('w_one'), word('w_two')],
  corrections: [correction('c_one')],
});

/** The Core composition of one app run over the records, so the user state survives between runs. */
async function run({
  records = new Map<string, string>(),
  clock = fakeClock('2026-10-19T09:00:00.000Z').clock,
  on = ['knowledge', 'corrections'],
}: {
  records?: Map<string, string>;
  clock?: Clock;
  on?: readonly FeatureSwitch[];
} = {}): Promise<Composition> {
  return openComposition({
    content,
    edition: {
      id: 'test',
      isFeatureEnabled: (feature) => on.includes(feature),
      languageTraits: { distractorRule: 'same-part-of-speech' },
      userSettingDefaults: {
        mix: { categoryIds: ['test'], corrections: true },
        notificationTimes: [],
      },
    },
    userState: await openUserState({ port: createMemoryUserStatePort(records) }),
    clock,
    random: { next: () => 0.25 },
  });
}

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

// Spec #461, ADR 0043: the knowledge module the cards and the Game mark through.
describe('Knowledge Marks', () => {
  it('marks a Word and a Correction, and keeps the marks for the next launch', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });

    await app.knowledge.tap('w_one', 'unknown');
    await app.knowledge.tap('c_one', 'known');

    const next = await run({ records });
    expect(next.knowledge.recordOf('w_one')).toEqual({
      mark: 'unknown',
      step: 1,
      reviewDay: '2026-10-20',
      learned: false,
    });
    expect(next.knowledge.recordOf('c_one')).toMatchObject({ mark: 'known', learned: true });
    expect(next.knowledge.markOf('w_one')).toBe('unknown');
    expect(next.knowledge.recordOf('w_two')).toBeUndefined();
  });

  it('changes the mark on a tap of the other one and removes it on a tap of the same one', async () => {
    const records = new Map<string, string>();
    const app = await run({ records });
    let told = 0;
    app.knowledge.subscribe(() => {
      told += 1;
    });

    await app.knowledge.tap('w_one', 'unknown');
    await app.knowledge.tap('w_one', 'known');
    expect(app.knowledge.markOf('w_one')).toBe('known');

    await app.knowledge.tap('w_one', 'known');
    expect(app.knowledge.recordOf('w_one')).toBeUndefined();
    expect(app.knowledge.markOf('w_one')).toBeUndefined();
    expect([...records.keys()].filter((key) => key.startsWith('knowledge.'))).toEqual([]);
    expect(told).toBe(3);
  });

  it('takes a tap on a due Entry as its Review answer, the same mark too', async () => {
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ clock: time.clock });
    await app.knowledge.tap('w_one', 'unknown');
    time.advance(DAY);

    expect(app.knowledge.markOf('w_one')).toBeUndefined();
    await app.knowledge.tap('w_one', 'unknown');

    expect(app.knowledge.recordOf('w_one')).toMatchObject({ step: 1, reviewDay: '2026-10-21' });
    expect(app.knowledge.markOf('w_one')).toBe('unknown');
  });

  it('answers by the local day: Unknown at 23:50 is due the morning after', async () => {
    // 23:50 in Kyiv, still 20:50 on the same day in UTC.
    const time = fakeClock('2026-10-19T20:50:00.000Z', 'Europe/Kyiv');
    const app = await run({ clock: time.clock });

    await app.knowledge.tap('w_one', 'unknown');
    time.advance(20 * 60_000);

    expect(app.knowledge.recordOf('w_one')?.reviewDay).toBe('2026-10-20');
    expect(app.knowledge.isDue('w_one')).toBe(true);
  });

  it('keeps an Entry due until it is answered, however many days pass', async () => {
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ clock: time.clock });
    await app.knowledge.tap('w_one', 'unknown');

    expect(app.knowledge.isDue('w_one')).toBe(false);
    time.advance(5 * DAY);
    expect(app.knowledge.isDue('w_one')).toBe(true);

    await app.knowledge.answer('w_one', 'known');
    expect(app.knowledge.isDue('w_one')).toBe(false);
    expect(app.knowledge.recordOf('w_one')).toMatchObject({ step: 3, reviewDay: '2026-10-27' });
  });

  it('answers by the interval rule alone, so Unknown on an Entry marked Unknown starts it again', async () => {
    const time = fakeClock('2026-10-19T09:00:00.000Z');
    const app = await run({ clock: time.clock });
    await app.knowledge.tap('w_one', 'known');

    await app.knowledge.answer('w_one', 'unknown');
    await app.knowledge.answer('w_one', 'unknown');

    expect(app.knowledge.recordOf('w_one')).toMatchObject({ mark: 'unknown', step: 1 });
  });

  it('marks nothing with the knowledge switch off, and keeps the marks there are', async () => {
    const records = new Map<string, string>();
    await (await run({ records })).knowledge.tap('w_one', 'unknown');
    const off = await run({ records, on: ['corrections'] });

    await off.knowledge.tap('w_one', 'unknown');
    await off.knowledge.tap('w_two', 'known');
    await off.knowledge.answer('c_one', 'unknown');

    expect(off.knowledge.recordOf('w_two')).toBeUndefined();
    expect(off.knowledge.recordOf('c_one')).toBeUndefined();
    expect((await run({ records })).knowledge.recordOf('w_one')).toMatchObject({
      mark: 'unknown',
    });
  });

  it('changes nothing in memory when keeping a mark fails', async () => {
    const records = new Map<string, string>();
    const port = createMemoryUserStatePort(records);
    const app = await openComposition({
      content,
      edition: {
        id: 'test',
        isFeatureEnabled: (feature) => feature === 'knowledge',
        languageTraits: { distractorRule: 'same-part-of-speech' },
        userSettingDefaults: {
          mix: { categoryIds: ['test'], corrections: false },
          notificationTimes: [],
        },
      },
      userState: await openUserState({ port }),
      clock: fakeClock().clock,
      random: { next: () => 0.25 },
    });
    port.write = () => Promise.reject(new Error('The disk is full'));

    await expect(app.knowledge.tap('w_one', 'unknown')).rejects.toThrow('The disk is full');

    expect(app.knowledge.recordOf('w_one')).toBeUndefined();
  });
});
