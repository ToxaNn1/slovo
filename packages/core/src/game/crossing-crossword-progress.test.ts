import { describe, expect, it } from 'vitest';

import { openComposition } from '../composition';
import type { FeatureSwitch, Word } from '../index';
import { createMemoryContentPort } from '../testing';
import { fakeClock, seededRandom, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { openCrossingCrossword, type CrossingCrossword } from './crossing-crossword-progress';
import { vocabulary } from './crossing-crossword.test-support';
import { crossingCellKey, type CrossingAction } from './crossing-play';
import type { GameXp, XpAction } from './game-xp';

/** An XP log that records every award under the XP log's key for the date, 15 XP each. */
function fakeXp() {
  const awards: XpAction[] = [];
  let committed = 0;
  const xp: GameXp = {
    award: (action) => {
      awards.push(action);
      const key = `xp.daily-crossword-${action.source === 'daily-crossword' ? action.date : '?'}`;
      return {
        changes: new Map([[key, JSON.stringify(action)]]),
        amount: 15,
        commit: () => {
          committed += 1;
        },
      };
    },
  };
  return { xp, awards, committed: () => committed };
}

async function open({
  records = new Map<string, string>(),
  start = '2026-11-04T09:00:00Z',
  under = vocabulary,
  on = ['game', 'dailyCrossword', 'crossingCrossword'],
  xp,
}: {
  records?: Map<string, string>;
  start?: string;
  under?: readonly Word[];
  on?: readonly FeatureSwitch[];
  xp?: GameXp;
} = {}) {
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  return openCrossingCrossword({
    entries: { wordsUnderRarityCeiling: () => Promise.resolve(under) },
    userState,
    clock: fakeClock(start).clock,
    edition: {
      isFeatureEnabled: (feature) => on.includes(feature),
      languageTraits: testEdition().languageTraits,
    },
    ...(xp ? { xp } : {}),
  });
}

async function opened(options: Parameters<typeof open>[0] = {}) {
  const opening = await open(options);
  if (opening.kind !== 'open') throw new Error(`Expected the puzzle, got ${opening.kind}`);
  return opening.crossword;
}

/** Selects the Word of this index and traces these letters on its wheel, then releases. */
async function trace(crossword: CrossingCrossword, index: number, letters: readonly string[]) {
  const target = crossword.puzzle.words[index];
  if (!target) throw new Error('No such Word');
  const select: CrossingAction = { type: 'select', place: target.start };
  await crossword.play(select);
  if (crossword.state.current !== index) await crossword.play(select);
  const used = new Set<number>();
  for (const letter of letters) {
    const tile = target.wheel.findIndex((candidate, i) => candidate === letter && !used.has(i));
    used.add(tile);
    await crossword.play({ type: 'extend', tile });
  }
  return crossword.play({ type: 'release' });
}

const solve = (crossword: CrossingCrossword, index: number) =>
  trace(crossword, index, crossword.puzzle.words[index]?.letters ?? []);

const filledCount = (crossword: CrossingCrossword) =>
  Object.values(crossword.state.cells).filter(({ kind }) => kind === 'filled').length;

describe('the crossing Daily Crossword', () => {
  it('is off while its Feature Switch is', async () => {
    expect(await open({ on: ['game', 'dailyCrossword'] })).toEqual({ kind: 'off' });
  });

  it('gives no-fill when the Words within the Rarity Ceiling fill no pattern', async () => {
    expect(await open({ under: vocabulary.slice(0, 3) })).toEqual({ kind: 'no-fill' });
  });

  it('gives every reader the same puzzle on a date, and another the next day', async () => {
    const first = await opened();
    expect((await opened()).puzzle).toEqual(first.puzzle);
    const next = await opened({ start: '2026-11-05T09:00:00Z' });
    expect(next.puzzle.words.map(({ word }) => word.id)).not.toEqual(
      first.puzzle.words.map(({ word }) => word.id),
    );
    expect(first.state.words.every(({ kind }) => kind === 'open')).toBe(true);
  });

  it('keeps the filled cells, the solved Words and the seconds kept when the reader comes back the same day', async () => {
    const records = new Map<string, string>();
    const crossword = await opened({ records });
    const [first] = crossword.puzzle.words;
    await crossword.play({ type: 'tick', seconds: 7 });
    await solve(crossword, 0);
    await crossword.play({ type: 'tick', seconds: 5 });
    await crossword.keep();
    expect(crossword.state.words[0]).toEqual({ kind: 'solved' });

    const again = await opened({ records, start: '2026-11-04T20:00:00Z' });
    expect(again.state.words[0]).toEqual({ kind: 'solved' });
    expect(again.state.words.filter(({ kind }) => kind === 'solved')).toHaveLength(1);
    expect(again.state.cells[crossingCellKey(first?.start ?? { row: 0, column: 0 })]).toEqual(
      crossword.state.cells[crossingCellKey(first?.start ?? { row: 0, column: 0 })],
    );
    expect(filledCount(again)).toBe(filledCount(crossword));
    expect(again.state).toMatchObject({ seconds: 12, hinted: false, trace: [] });
  });

  it('keeps the seconds of a solve on the next tick-free reload, not the ticks after', async () => {
    const records = new Map<string, string>();
    const crossword = await opened({ records });
    await crossword.play({ type: 'tick', seconds: 3 });
    await solve(crossword, 0);
    await crossword.play({ type: 'tick', seconds: 4 });

    expect((await opened({ records })).state.seconds).toBe(3);
  });

  it('starts empty on a new date', async () => {
    const records = new Map<string, string>();
    const crossword = await opened({ records });
    await solve(crossword, 0);

    const tomorrow = await opened({ records, start: '2026-11-05T09:00:00Z' });
    expect(tomorrow.state.words.every(({ kind }) => kind === 'open')).toBe(true);
    expect(filledCount(tomorrow)).toBe(0);
    expect(tomorrow.state.seconds).toBe(0);
  });

  it('starts empty on another puzzle the same day', async () => {
    const records = new Map<string, string>();
    const crossword = await opened({ records });
    await solve(crossword, 0);
    await crossword.play({ type: 'tick', seconds: 9 });
    await crossword.keep();

    const other = await opened({
      records,
      under: [...vocabulary, word('w_newt2', { lemma: 'kiwi' })],
    });
    expect(other.puzzle).not.toEqual(crossword.puzzle);
    expect(other.state.words.every(({ kind }) => kind === 'open')).toBe(true);
    expect(filledCount(other)).toBe(0);
    expect(other.state.seconds).toBe(0);
  });

  it('writes nothing on a miss or a move, only on a solve', async () => {
    const records = new Map<string, string>();
    const crossword = await opened({ records });
    const [first] = crossword.puzzle.words;
    await crossword.play({ type: 'next' });
    await trace(crossword, 0, [...(first?.letters ?? [])].reverse());
    expect(crossword.state.words[0]).toEqual({ kind: 'open' });
    expect(records.has('crossword.crossing')).toBe(false);

    await solve(crossword, 0);
    expect(records.has('crossword.crossing')).toBe(true);
  });

  it('appends the Daily Crossword XP of the date once when every Word is solved, in the write that keeps the solve', async () => {
    const records = new Map<string, string>();
    const { xp, awards, committed } = fakeXp();
    const crossword = await opened({ records, xp });
    for (let i = 0; i < crossword.puzzle.words.length - 1; i += 1) await solve(crossword, i);
    expect(awards).toEqual([]);
    expect(records.has('xp.daily-crossword-2026-11-04')).toBe(false);

    await solve(crossword, crossword.puzzle.words.length - 1);
    expect(crossword.state.words.every(({ kind }) => kind === 'solved')).toBe(true);
    expect(awards).toEqual([{ source: 'daily-crossword', date: '2026-11-04' }]);
    expect(committed()).toBe(1);
    expect(records.has('xp.daily-crossword-2026-11-04')).toBe(true);

    await crossword.play({ type: 'tick', seconds: 1 });
    const again = await opened({ records, xp, start: '2026-11-04T20:00:00Z' });
    expect(again.state.words.every(({ kind }) => kind === 'solved')).toBe(true);
    await again.play({ type: 'release' });
    expect(awards).toHaveLength(1);
  });
});

describe('the crossing Daily Crossword of the composition', () => {
  async function app(on: readonly FeatureSwitch[]) {
    return openComposition({
      content: createMemoryContentPort({
        categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
        words: vocabulary,
      }),
      edition: testEdition({ isFeatureEnabled: (feature) => on.includes(feature) }),
      userState: await openUserState({ port: createMemoryUserStatePort(new Map()) }),
      clock: fakeClock('2026-11-04T09:00:00Z').clock,
      random: seededRandom(7),
    });
  }

  it('is off while the Edition has it off', async () => {
    const composition = await app(['game', 'dailyCrossword']);
    expect(await composition.openCrossingCrossword()).toEqual({ kind: 'off' });
  });

  it('opens the puzzle of the Words within the Rarity Ceiling, which a solve plays', async () => {
    const composition = await app(['game', 'dailyCrossword', 'crossingCrossword']);
    const opening = await composition.openCrossingCrossword();
    if (opening.kind !== 'open') throw new Error(`Expected the puzzle, got ${opening.kind}`);
    const ids = vocabulary.map(({ id }) => id);
    for (const { word: placed } of opening.crossword.puzzle.words) expect(ids).toContain(placed.id);
    const before = opening.crossword.state.words.filter(({ kind }) => kind === 'solved').length;
    await solve(opening.crossword, opening.crossword.state.current);
    expect(opening.crossword.state.words.filter(({ kind }) => kind === 'solved').length).toBe(
      before + 1,
    );
  });
});
