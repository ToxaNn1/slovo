import { describe, expect, it } from 'vitest';

import { openTracedCrossword, type FeatureSwitch, type PuzzleAction, type Word } from '../index';
import { fakeClock, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';

const words = [
  'w_кіт',
  'w_дім',
  'w_вовк',
  'w_сова',
  'w_річка',
  'w_весна',
  'w_яблуко',
  'w_зоря',
].map((id) => word(id));

async function open({
  records = new Map<string, string>(),
  start = '2026-11-04T09:00:00Z',
  under = words,
  on = ['game', 'dailyCrossword', 'tracedCrossword'],
}: {
  records?: Map<string, string>;
  start?: string;
  under?: readonly Word[];
  on?: readonly FeatureSwitch[];
} = {}) {
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  return openTracedCrossword({
    entries: { wordsUnderRarityCeiling: () => Promise.resolve(under) },
    userState,
    clock: fakeClock(start).clock,
    edition: { isFeatureEnabled: (feature) => on.includes(feature) },
  });
}

async function opened(options: Parameters<typeof open>[0] = {}) {
  const opening = await open(options);
  if (opening.kind !== 'open') throw new Error('Expected the puzzle');
  return opening.crossword;
}

const traceOf = (path: readonly { row: number; column: number }[]): PuzzleAction[] => [
  ...path.map((place): PuzzleAction => ({ type: 'extend', place })),
  { type: 'release' },
];

describe('the traced Daily Crossword', () => {
  it('is off while its Feature Switch is', async () => {
    expect(await open({ on: ['game', 'dailyCrossword'] })).toEqual({ kind: 'off' });
  });

  it('gives no-tiling when the Words within the Rarity Ceiling cannot fill the grid', async () => {
    expect(await open({ under: words.slice(0, 3) })).toEqual({ kind: 'no-tiling' });
  });

  it('gives every reader the same puzzle on a date, and another the next day', async () => {
    const first = await opened();
    expect((await opened()).puzzle).toEqual(first.puzzle);
    expect((await opened({ start: '2026-11-05T09:00:00Z' })).puzzle.grid).not.toEqual(
      first.puzzle.grid,
    );
  });

  it('keeps the Words found when the reader comes back the same day, and starts afresh the next', async () => {
    const records = new Map<string, string>();
    const crossword = await opened({ records });
    const [hidden] = crossword.puzzle.words;
    for (const action of traceOf(hidden?.path ?? [])) await crossword.play(action);
    expect(crossword.state.words[0]).toEqual({ kind: 'found' });

    const again = await opened({ records, start: '2026-11-04T20:00:00Z' });
    expect(again.state.words[0]).toEqual({ kind: 'found' });
    expect(again.state.words.filter(({ kind }) => kind === 'found')).toHaveLength(1);

    const tomorrow = await opened({ records, start: '2026-11-05T09:00:00Z' });
    expect(tomorrow.state.words.every(({ kind }) => kind === 'hidden')).toBe(true);
  });

  it('keeps no trace, and is solved once every Word is found', async () => {
    const records = new Map<string, string>();
    const crossword = await opened({ records });
    const [hidden] = crossword.puzzle.words;
    await crossword.play({ type: 'extend', place: hidden?.path[0] ?? { row: 0, column: 0 } });
    expect((await opened({ records })).state.trace).toEqual([]);

    for (const { path } of crossword.puzzle.words)
      for (const action of traceOf(path)) await crossword.play(action);
    expect(crossword.state.words.every(({ kind }) => kind === 'found')).toBe(true);
    expect((await opened({ records })).state.words.every(({ kind }) => kind === 'found')).toBe(
      true,
    );
  });
});
