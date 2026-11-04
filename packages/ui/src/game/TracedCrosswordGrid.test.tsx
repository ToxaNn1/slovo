import { playPuzzle, startPuzzle, type CrosswordPuzzle, type PuzzleAction } from '@slovo/core';
import type { Word } from '@slovo/contracts';
import { describe, expect, it } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import {
  coreTokens,
  EditionProvider,
  TokensProvider,
  TracedCrosswordGrid,
  type TracedMiss,
} from '@slovo/ui';
import { testStrings } from '../test-strings';

/**
 * A 3 × 3 puzzle of three hidden Words, one per row:
 *
 *     c a t
 *     d o g
 *     o w l
 */
const rows = ['cat', 'dog', 'owl'];
const clues = ['A pet that purrs', 'A pet that barks', 'A bird of the night'];

/** A Word of the Language Pack with its lemma and its primary Definition, nothing else. */
const wordOf = (lemma: string, primaryDefinition: string): Word => ({
  kind: 'word',
  id: `w_${lemma}`,
  lemma,
  stress: [1],
  partOfSpeech: 'noun',
  primaryDefinition,
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
});

const puzzle: CrosswordPuzzle = {
  date: '2026-11-04',
  grid: rows.map((row) => Array.from(row, (letter) => ({ letter, stressed: letter === 'a' }))),
  words: rows.map((row, r) => {
    const clue = clues[r] ?? '';
    return {
      word: wordOf(row, clue),
      clue,
      path: [0, 1, 2].map((column) => ({ row: r, column })),
    };
  }),
};

/** The grid as a screen drives it: the Core's reducer over its state, and a miss on a release that locks nothing. */
function Crossword({ accessibleMode = false }: { accessibleMode?: boolean }) {
  const [state, setState] = useState(() => startPuzzle(puzzle, []));
  const [miss, setMiss] = useState<TracedMiss>();
  const play = (action: PuzzleAction) => {
    setState((now) => {
      const next = playPuzzle(puzzle, now, action);
      const locked = next.words.filter((w) => w.kind === 'found').length;
      if (
        action.type === 'release' &&
        now.trace.length > 1 &&
        locked === now.words.filter((w) => w.kind === 'found').length
      )
        setMiss((last) => ({ key: (last?.key ?? 0) + 1, path: now.trace }));
      return next;
    });
  };
  return (
    <TracedCrosswordGrid
      testID="grid"
      grid={puzzle.grid}
      words={puzzle.words.map(({ clue, path }, i) =>
        state.words[i]?.kind === 'found'
          ? { kind: 'found', clue, path }
          : { kind: 'hidden', clue, length: path.length },
      )}
      trace={state.trace}
      miss={miss}
      accessibleMode={accessibleMode}
      onExtend={(place) => {
        play({ type: 'extend', place });
      }}
      onStepBack={() => {
        play({ type: 'stepBack' });
      }}
      onRelease={() => {
        play({ type: 'release' });
      }}
      texts={{
        cellLabel: (letter, { row, column }) =>
          `${letter}, row ${String(row + 1)}, column ${String(column + 1)}`,
        clueLabel: (clue, found) => (found === undefined ? clue : `${clue}: ${found}`),
        check: 'Check',
      }}
    />
  );
}

/** Renders the grid laid out 3 × 3 in a 304-point square: a cell of 96 points every 104. */
async function renderGrid(accessibleMode = false) {
  await render(
    <TokensProvider tokens={coreTokens} colorScheme="light">
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <Crossword accessibleMode={accessibleMode} />
      </EditionProvider>
    </TokensProvider>,
  );
  await fireEvent(screen.getByTestId('grid'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 304, height: 304 } },
  });
}

const centre = (index: number) => index * 104 + 48;

/** A finger drawn through the centres of the cells, then lifted. */
async function trace(cells: readonly [number, number][]) {
  const points = cells.map(([row, column]) => ({ x: centre(column), y: centre(row) }));
  const [first, ...rest] = points;
  await act(() => {
    fireGestureHandler(getByGestureTestId('grid-trace'), [
      { state: State.BEGAN, ...first },
      ...rest.map((point) => ({ state: State.ACTIVE, ...point })),
      { state: State.END, ...points[points.length - 1] },
    ]);
  });
}

const clue = (index: number) => screen.getByTestId(`grid-clue-${String(index)}`);

describe('the traced Daily Crossword grid (ADR 0073)', () => {
  it('shows every letter with its Stress mark and every clue with empty answer tiles', async () => {
    await renderGrid();
    expect(screen.getByLabelText('á, row 1, column 2')).toBeTruthy();
    expect(clue(0).props['accessibilityLabel']).toBe('A pet that purrs');
    expect(screen.getByText('A bird of the night')).toBeTruthy();
  });

  it('locks a Word traced from its first letter to its last and fills its answer tiles', async () => {
    await renderGrid();
    await trace([
      [1, 0],
      [1, 1],
      [1, 2],
    ]);
    expect(clue(1).props['accessibilityLabel']).toBe('A pet that barks: dog');
    expect(clue(1).props['accessibilityState']).toEqual({ checked: true });
    expect(clue(0).props['accessibilityState']).toEqual({ checked: false });
  });

  it('clears a wrong trace and locks nothing', async () => {
    await renderGrid();
    await trace([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
    for (const index of [0, 1, 2])
      expect(clue(index).props['accessibilityState']).toEqual({ checked: false });
    expect(screen.getByTestId('grid-1-1').props['accessibilityState']).toMatchObject({
      selected: false,
    });
  });

  it('solves a Word in accessible mode with cell taps and Check', async () => {
    await renderGrid(true);
    const check = screen.getByRole('button', { name: 'Check' });
    for (const label of ['o, row 3, column 1', 'w, row 3, column 2', 'l, row 3, column 3'])
      await fireEvent.press(screen.getByLabelText(label));
    await fireEvent.press(check);
    expect(clue(2).props['accessibilityLabel']).toBe('A bird of the night: owl');
  });

  it('steps back in accessible mode when the last cell is tapped again', async () => {
    await renderGrid(true);
    await fireEvent.press(screen.getByLabelText('c, row 1, column 1'));
    await fireEvent.press(screen.getByLabelText('á, row 1, column 2'));
    await fireEvent.press(screen.getByLabelText('á, row 1, column 2'));
    expect(screen.getByTestId('grid-0-1').props['accessibilityState']).toMatchObject({
      selected: false,
    });
    expect(screen.getByTestId('grid-0-0').props['accessibilityState']).toMatchObject({
      selected: true,
    });
  });
});
