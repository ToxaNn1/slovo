import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { useState, type ReactElement } from 'react';
import { Text } from 'react-native';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import {
  coreTokens,
  CrossingClueBar,
  CrossingGrid,
  EditionProvider,
  LetterWheel,
  TokensProvider,
  type CrossingGridCell,
  type WheelMiss,
} from '@slovo/ui';
import { testStrings } from '../test-strings';
import { crossingCrosswordLayout, offsetShadow } from '../tokens';

const answer = ['c', 'a', 't'];
const wheelLetters = ['t', 'c', 'a'];

/** The wheel as a screen drives it: a trace that spells the answer solves, any other is a miss. */
function Wheel({ accessibleMode = false }: { accessibleMode?: boolean }) {
  const [state, setState] = useState<{
    trace: readonly number[];
    miss: WheelMiss | undefined;
    solved: boolean;
    coach: boolean;
  }>({ trace: [], miss: undefined, solved: false, coach: true });
  const release = (now: typeof state): typeof state => {
    const spelled = now.trace.map((tile) => wheelLetters[tile] ?? '');
    if (spelled.join('') === answer.join('')) return { ...now, trace: [], solved: true };
    if (spelled.length === 0) return now;
    return { ...now, trace: [], miss: { key: (now.miss?.key ?? 0) + 1, letters: spelled } };
  };
  return (
    <>
      <LetterWheel
        letters={wheelLetters}
        trace={state.trace}
        miss={state.miss}
        coach={state.coach}
        accessibleMode={accessibleMode}
        onExtend={(tile) => {
          setState((now) => ({
            ...now,
            coach: false,
            trace: now.trace.includes(tile) ? now.trace : [...now.trace, tile],
          }));
        }}
        onStepBack={() => {
          setState((now) => ({ ...now, trace: now.trace.slice(0, -1) }));
        }}
        onRelease={() => {
          setState(release);
        }}
        texts={{ tileLabel: (letter) => `Letter ${letter}`, check: 'Check' }}
        testID="wheel"
      />
      {state.solved && <Text testID="solved" />}
    </>
  );
}

const renderIn = async (ui: ReactElement, colorScheme: 'light' | 'dark' = 'light') => {
  await render(
    <GestureHandlerRootView>
      <TokensProvider tokens={coreTokens} colorScheme={colorScheme}>
        <EditionProvider edition={{ locale: 'uk' }} strings={testStrings({})}>
          {ui}
        </EditionProvider>
      </TokensProvider>
    </GestureHandlerRootView>,
  );
};

/** The centre of a tile, as the wheel lays tiles out on its circle. */
const centreOf = (index: number) => {
  const { wheel, orbit } = crossingCrosswordLayout;
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / wheelLetters.length;
  return { x: wheel / 2 + orbit * Math.cos(angle), y: wheel / 2 + orbit * Math.sin(angle) };
};

const drag = async (tiles: number[]) => {
  const points = tiles.map(centreOf);
  const [first, ...rest] = points;
  await act(() => {
    fireGestureHandler(getByGestureTestId('wheel-trace'), [
      { state: State.BEGAN, ...first },
      ...rest.map((point) => ({ state: State.ACTIVE, ...point })),
      { state: State.END, ...points[points.length - 1] },
    ]);
  });
};

describe('LetterWheel', () => {
  it('spells the trace in path chips and solves when the finger lifts on the answer', async () => {
    await renderIn(<Wheel />);
    expect(screen.getByTestId('wheel-coach', { includeHiddenElements: true })).toBeTruthy();
    await drag([1, 2, 0]);
    expect(screen.queryByTestId('wheel-coach', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('solved')).toBeTruthy();
  });

  it('shows a trace that spelled nothing as a miss in the path chips', async () => {
    await renderIn(<Wheel />);
    await drag([0, 1]);
    expect(screen.queryByTestId('solved')).toBeNull();
    expect(screen.getByTestId('wheel-path')).toHaveProp('accessibilityLabel', 'tc');
  });

  it('draws the path chips uppercase, as the tiles', async () => {
    await renderIn(<Wheel />);
    await drag([0, 1]);
    for (const [i, letter] of ['t', 'c'].entries()) {
      const chip = within(screen.getByTestId(`wheel-chip-${String(i)}`)).getByText(letter);
      expect(chip).toHaveStyle({ textTransform: 'uppercase' });
    }
  });

  it('traces by buttons and Check in accessible mode, a tap on the last tile stepping back', async () => {
    await renderIn(<Wheel accessibleMode />);
    expect(screen.queryByTestId('wheel-coach', { includeHiddenElements: true })).toBeNull();
    await fireEvent.press(screen.getByLabelText('Letter c'));
    await fireEvent.press(screen.getByLabelText('Letter t'));
    await fireEvent.press(screen.getByLabelText('Letter t'));
    await fireEvent.press(screen.getByLabelText('Letter a'));
    expect(screen.getByTestId('wheel-path')).toHaveProp('accessibilityLabel', 'ca');
    await fireEvent.press(screen.getByLabelText('Letter t'));
    await fireEvent.press(screen.getByText('Check'));
    expect(screen.getByTestId('solved')).toBeTruthy();
  });
});

describe('CrossingGrid and CrossingClueBar', () => {
  const cell = (over: Partial<Extract<CrossingGridCell, { kind: 'cell' }>>): CrossingGridCell => ({
    kind: 'cell',
    letter: undefined,
    number: undefined,
    current: false,
    solved: false,
    label: '',
    ...over,
  });

  it('asks to select a tapped cell and reads cells and the clue with number and direction', async () => {
    const onSelect = jest.fn();
    const onNext = jest.fn();
    await renderIn(
      <>
        <CrossingClueBar
          number="1"
          clue="A pet that purrs"
          label="1 across. A pet that purrs"
          next="Next word"
          onNext={onNext}
          testID="bar"
        />
        <CrossingGrid
          cells={[
            [cell({ number: 1, current: true, label: '1 across, cell 1' }), { kind: 'block' }],
            [cell({ letter: 'a', solved: true, label: 'a' }), cell({})],
          ]}
          onSelect={onSelect}
          testID="grid"
        />
      </>,
    );
    await fireEvent.press(screen.getByLabelText('1 across, cell 1'));
    expect(onSelect).toHaveBeenCalledWith({ row: 0, column: 0 });
    expect(screen.getByTestId('grid-0-1-block', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('1 across. A pet that purrs')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Next word'));
    expect(onNext).toHaveBeenCalled();
  });

  it('shrinks its cells to the room the screen leaves it, and never past the board size', async () => {
    const { cell: side, cellGap } = crossingCrosswordLayout;
    const edge = offsetShadow.rest.depth;
    const block: CrossingGridCell = { kind: 'block' };
    await renderIn(
      <CrossingGrid
        cells={[
          [block, block],
          [block, block],
        ]}
        onSelect={jest.fn()}
        testID="grid"
      />,
    );
    const blockCell = () => screen.getByTestId('grid-0-0-block', { includeHiddenElements: true });
    expect(blockCell()).toHaveStyle({ width: side, height: side });

    // A short screen leaves the grid 100 pt of height: two rows, their tile edges and a gap fit in it.
    await fireEvent(screen.getByTestId('grid-room'), 'layout', {
      nativeEvent: { layout: { width: 300, height: 100 } },
    });
    const short = (100 - cellGap) / 2 - edge;
    expect(blockCell()).toHaveStyle({ width: short, height: short });

    // A narrow one: the width decides.
    await fireEvent(screen.getByTestId('grid-room'), 'layout', {
      nativeEvent: { layout: { width: 80, height: 300 } },
    });
    expect(blockCell()).toHaveStyle({ width: (80 - cellGap) / 2 });

    // Room to spare keeps the board's cell.
    await fireEvent(screen.getByTestId('grid-room'), 'layout', {
      nativeEvent: { layout: { width: 600, height: 600 } },
    });
    expect(blockCell()).toHaveStyle({ width: side });
  });

  it('fits letter cells with their pressed edge into the room the screen leaves', async () => {
    const { cell: boardSide, cellGap } = crossingCrosswordLayout;
    const edge = offsetShadow.rest.depth;
    await renderIn(
      <CrossingGrid
        cells={[
          [cell({ label: 'r0c0' }), cell({ label: 'r0c1' })],
          [cell({ label: 'r1c0' }), cell({ label: 'r1c1' })],
        ]}
        onSelect={jest.fn()}
        testID="grid"
      />,
    );
    // Its room asks for the board's rows, each with its tile's edge under it.
    expect(screen.getByTestId('grid-room')).toHaveStyle({
      flexBasis: 2 * (boardSide + edge) + cellGap,
    });

    // 100 pt of height holds two rows, their two edges and a gap.
    await fireEvent(screen.getByTestId('grid-room'), 'layout', {
      nativeEvent: { layout: { width: 300, height: 100 } },
    });
    const side = (100 - cellGap - 2 * edge) / 2;
    expect(screen.getByTestId('grid-1-1-face')).toHaveStyle({ width: side, height: side });
  });

  it('draws the clue bar as the dark plate in both Themes', async () => {
    const { light } = coreTokens.colors;
    for (const scheme of ['light', 'dark'] as const) {
      await renderIn(
        <CrossingClueBar
          number="1"
          clue="A pet that purrs"
          label="1 across. A pet that purrs"
          next="Next word"
          onNext={jest.fn()}
          testID="bar"
        />,
        scheme,
      );
      expect(screen.getByTestId('bar')).toHaveStyle({ backgroundColor: light.ink });
      expect(screen.getByTestId('bar-clue')).toHaveStyle({ color: light.background });
    }
  });
});
