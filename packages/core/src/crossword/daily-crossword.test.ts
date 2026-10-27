import { CrosswordDaySchema, type CrosswordDay } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import {
  createMemoryUserStatePort,
  openDailyCrossword,
  openUserState,
  type Clock,
  type CrosswordReadPort,
  type FeatureSwitch,
} from '../index';
import { fakeClock } from '../test-support';

/**
 * A day of four words:
 *
 *     к і т . .
 *     о . а . .
 *     т . к и т
 */
function day(date: string, clues = ['кіт', 'кот', 'так', 'кит']): CrosswordDay {
  const [cat = '', tomcat = '', yes = '', whale = ''] = clues;
  return CrosswordDaySchema.parse({
    date,
    words: [
      { entryId: 'w_cat', answer: 'кіт', clue: cat, row: 0, column: 0, direction: 'across' },
      { entryId: 'w_tomcat', answer: 'кот', clue: tomcat, row: 0, column: 0, direction: 'down' },
      { entryId: 'w_yes', answer: 'так', clue: yes, row: 0, column: 2, direction: 'down' },
      { entryId: 'w_whale', answer: 'кит', clue: whale, row: 2, column: 2, direction: 'across' },
    ],
  });
}

/** A 5 × 5 grid with no letter typed. */
const emptyGrid = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => undefined));

const pack: CrosswordReadPort = {
  crosswordDay: (date) =>
    Promise.resolve(
      [
        day('2026-10-11', ['Домашній звір', 'Він же', 'Згода', 'Морський ссавець']),
        day('2026-10-12'),
      ].find((candidate) => candidate.date === date),
    ),
};

/** The Daily Crossword of the clock's local date over the records, as one app run opens it. */
async function open({
  records = new Map<string, string>(),
  clock = fakeClock().clock,
  on = ['game', 'dailyCrossword'],
}: { records?: Map<string, string>; clock?: Clock; on?: readonly FeatureSwitch[] } = {}) {
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  return openDailyCrossword({
    content: pack,
    userState,
    clock,
    // As the Edition does, a switch is on only while `game` is on too.
    edition: { isFeatureEnabled: (feature) => on.includes('game') && on.includes(feature) },
  });
}

/** Types the answer into the word's cells, from its first letter on. */
async function fill(
  crossword: NonNullable<Awaited<ReturnType<typeof open>>>,
  answer: string,
  { row, column }: { row: number; column: number },
  direction: 'across' | 'down',
) {
  for (const [i, letter] of Array.from(answer).entries()) {
    await crossword.setLetter(
      direction === 'across' ? { row, column: column + i } : { row: row + i, column },
      letter,
    );
  }
}

describe('the Daily Crossword', () => {
  it("serves the crossword of the device's local date: its words, clues and an empty grid", async () => {
    const crossword = await open();

    expect(crossword?.state.date).toBe('2026-10-11');
    expect(crossword?.state.words).toEqual([
      {
        start: { row: 0, column: 0 },
        direction: 'across',
        length: 3,
        clue: 'Домашній звір',
        right: false,
      },
      { start: { row: 0, column: 0 }, direction: 'down', length: 3, clue: 'Він же', right: false },
      { start: { row: 0, column: 2 }, direction: 'down', length: 3, clue: 'Згода', right: false },
      {
        start: { row: 2, column: 2 },
        direction: 'across',
        length: 3,
        clue: 'Морський ссавець',
        right: false,
      },
    ]);
    expect(crossword?.state.letters).toEqual(emptyGrid);
  });

  it('turns to the next day at local midnight, not at midnight UTC', async () => {
    const time = fakeClock('2026-10-11T23:59:00+03:00');
    const records = new Map<string, string>();
    const before = await open({ records, clock: time.clock });
    await before?.setLetter({ row: 0, column: 0 }, 'к');

    time.set('2026-10-12T00:01:00+03:00');
    const after = await open({ records, clock: time.clock });

    expect(after?.state.date).toBe('2026-10-12');
    expect(after?.state.letters[0]?.[0]).toBeUndefined();
  });

  it('follows the time zone the device is in', async () => {
    const time = fakeClock('2026-10-11T23:30:00+03:00');
    time.moveTo('Asia/Tokyo');

    expect((await open({ clock: time.clock }))?.state.date).toBe('2026-10-12');
  });

  it('keeps the typed letters through a restart of the app', async () => {
    const records = new Map<string, string>();
    const first = await open({ records });
    await first?.setLetter({ row: 0, column: 1 }, 'і');
    await first?.setLetter({ row: 2, column: 4 }, 'Т');

    const again = await open({ records });

    expect(again?.state.letters[0]?.[1]).toBe('і');
    expect(again?.state.letters[2]?.[4]).toBe('т');
  });

  it('erases a letter, and takes none where no word reads or that is not one letter', async () => {
    const crossword = await open();
    await crossword?.setLetter({ row: 0, column: 0 }, 'к');
    await crossword?.setLetter({ row: 0, column: 0 }, undefined);
    await crossword?.setLetter({ row: 1, column: 1 }, 'а');
    await crossword?.setLetter({ row: 0, column: 1 }, 'ab');
    await crossword?.setLetter({ row: 0, column: 2 }, '1');

    expect(crossword?.state.letters).toEqual(emptyGrid);
  });

  it('marks a fully right word right, and its crossing word only once it is right too', async () => {
    const crossword = await open();
    if (crossword === undefined) throw new Error('Expected a crossword');
    await fill(crossword, 'кіт', { row: 0, column: 0 }, 'across');

    expect(crossword.state.words.map((word) => word.right)).toEqual([true, false, false, false]);

    await fill(crossword, 'кот', { row: 0, column: 0 }, 'down');

    expect(crossword.state.words.map((word) => word.right)).toEqual([true, true, false, false]);
  });

  it('never flags a wrong letter: a wrong word is only not right', async () => {
    const crossword = await open();
    if (crossword === undefined) throw new Error('Expected a crossword');
    await fill(crossword, 'кит', { row: 0, column: 0 }, 'across');

    expect(crossword.state.letters[0]?.slice(0, 3)).toEqual(['к', 'и', 'т']);
    expect(crossword.state.words[0]?.right).toBe(false);
  });

  it('keeps a right word as it is', async () => {
    const crossword = await open();
    if (crossword === undefined) throw new Error('Expected a crossword');
    await fill(crossword, 'кіт', { row: 0, column: 0 }, 'across');
    await crossword.setLetter({ row: 0, column: 1 }, undefined);
    await crossword.setLetter({ row: 0, column: 2 }, 'с');

    expect(crossword.state.letters[0]?.slice(0, 3)).toEqual(['к', 'і', 'т']);
    expect(crossword.state.words[0]?.right).toBe(true);
  });

  it('makes nothing Seen and changes no Knowledge Mark: it keeps only its own device record', async () => {
    const records = new Map<string, string>();
    const crossword = await open({ records });
    if (crossword === undefined) throw new Error('Expected a crossword');
    const before = new Set(records.keys());
    await fill(crossword, 'кіт', { row: 0, column: 0 }, 'across');
    await fill(crossword, 'кот', { row: 0, column: 0 }, 'down');
    await fill(crossword, 'так', { row: 0, column: 2 }, 'down');
    await fill(crossword, 'кит', { row: 2, column: 2 }, 'across');

    expect([...records.keys()].filter((key) => !before.has(key))).toEqual(['crossword.progress']);
  });

  it('is off with the Daily Crossword switch or the Game switch off', async () => {
    expect(await open({ on: ['game'] })).toBeUndefined();
    expect(await open({ on: ['dailyCrossword'] })).toBeUndefined();
  });

  it('is absent on a date the pack has no crossword for', async () => {
    expect(await open({ clock: fakeClock('2026-10-20T09:00:00+03:00').clock })).toBeUndefined();
  });
});
