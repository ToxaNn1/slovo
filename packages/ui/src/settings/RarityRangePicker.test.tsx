import type { Haptics } from '@slovo/core';
import {
  EditionProvider,
  HapticsProvider,
  RarityRangePicker,
  type RarityRangeValue,
} from '@slovo/ui';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { testStrings } from '../test-strings';

const strings = testStrings({
  settings: {
    rarity: {
      title: 'RARITY',
      range: 'from {from} to {to}',
      single: 'only {rarity}',
      bar: 'Rarity {rarity}',
      hint: 'Tap a bar or drag across them.',
    },
  },
});

const impactLight = jest.fn();
const haptics: Haptics = {
  selection: jest.fn(),
  impactLight,
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

const kept: RarityRangeValue[] = [];

/** The picker over a range kept as the screen keeps it. */
function Picker({ initial }: { initial: RarityRangeValue }) {
  const [range, setRange] = useState(initial);
  return (
    <RarityRangePicker
      rarities={[1, 2, 3, 4, 5]}
      range={range}
      onChange={(next) => {
        kept.push(next);
        setRange(next);
        return Promise.resolve();
      }}
      testID="rarity"
    />
  );
}

/** Ends of `keep` not yet done; `finish` keeps them all, as the Core does after it writes. */
const waiting: (() => void)[] = [];
async function finish() {
  await act(async () => {
    for (const done of waiting.splice(0)) done();
    await new Promise((settled) => setTimeout(settled, 0));
  });
}

/** The picker over a range the screen hears of only once it is kept, some time after the change. */
function SlowPicker({ initial }: { initial: RarityRangeValue }) {
  const [range, setRange] = useState(initial);
  return (
    <RarityRangePicker
      rarities={[1, 2, 3, 4, 5]}
      range={range}
      onChange={(next) => {
        kept.push(next);
        return new Promise<void>((resolve) => {
          waiting.push(() => {
            setRange(next);
            resolve();
          });
        });
      }}
      testID="rarity"
    />
  );
}

async function draw(from: number, to: number, slow = false) {
  const Drawn = slow ? SlowPicker : Picker;
  await render(
    <GestureHandlerRootView>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <HapticsProvider haptics={haptics}>
          <Drawn initial={{ from, to }} />
        </HapticsProvider>
      </EditionProvider>
    </GestureHandlerRootView>,
  );
}

const value = () => screen.getByTestId('rarity-value');
const bar = (rarity: number) => screen.getByRole('button', { name: `Rarity ${String(rarity)}` });

async function tap(rarity: number) {
  await fireEvent.press(bar(rarity));
}

/** A drag across the bars, 500 points wide, from `x` to each of `xs`. */
async function dragAcross(x: number, ...xs: number[]) {
  await fireEvent(screen.getByTestId('rarity-bars'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 500, height: 80 } },
  });
  await act(() => {
    fireGestureHandler(getByGestureTestId('rarity-drag'), [
      { state: State.BEGAN, x },
      { state: State.ACTIVE, x },
      ...xs.map((to) => ({ state: State.ACTIVE, x: to })),
      { state: State.END, x: xs.at(-1) ?? x },
    ]);
  });
}

describe('RarityRangePicker', () => {
  beforeEach(() => {
    kept.length = 0;
    waiting.length = 0;
    impactLight.mockClear();
  });

  it('names the range it holds and marks its bars as chosen', async () => {
    await draw(2, 4);

    expect(screen.getByText('RARITY')).toBeOnTheScreen();
    expect(value()).toHaveTextContent('from 2 to 4');
    expect(bar(1)).not.toBeSelected();
    expect(bar(2)).toBeSelected();
    expect(bar(4)).toBeSelected();
    expect(bar(5)).not.toBeSelected();
  });

  it('names a range of one rarity «only N»', async () => {
    await draw(3, 3);

    expect(value()).toHaveTextContent('only 3');
  });

  it('pulls the nearer end out to a bar tapped outside the range, with a light haptic', async () => {
    await draw(2, 3);

    await tap(5);
    expect(value()).toHaveTextContent('from 2 to 5');
    await tap(1);
    expect(value()).toHaveTextContent('from 1 to 5');
    expect(kept).toEqual([
      { from: 2, to: 5 },
      { from: 1, to: 5 },
    ]);
    expect(impactLight).toHaveBeenCalledTimes(2);
  });

  it('moves the nearer end in to a bar tapped inside the range', async () => {
    await draw(1, 5);

    await tap(2);
    expect(value()).toHaveTextContent('from 2 to 5');
    await tap(4);
    expect(value()).toHaveTextContent('from 2 to 4');
  });

  it('moves the top in on a tap halfway between the ends', async () => {
    await draw(1, 5);

    await tap(3);
    expect(value()).toHaveTextContent('from 1 to 3');
  });

  it('leaves one rarity alone on a tap on an end, and a tap on that one bar takes every rarity back', async () => {
    await draw(2, 4);

    await tap(4);
    expect(value()).toHaveTextContent('only 4');
    expect(bar(3)).not.toBeSelected();
    await tap(4);
    expect(value()).toHaveTextContent('from 1 to 5');
    expect(kept).toEqual([
      { from: 4, to: 4 },
      { from: 1, to: 5 },
    ]);
    expect(impactLight).toHaveBeenCalledTimes(2);
  });

  it('says under the bars how a range is picked', async () => {
    await draw(5, 5);

    expect(screen.getByText('Tap a bar or drag across them.')).toBeOnTheScreen();
  });

  it('picks the range a drag spans, either way, and keeps it when the finger lifts', async () => {
    await draw(1, 5);

    await dragAcross(450, 350, 150);
    expect(value()).toHaveTextContent('from 2 to 5');
    expect(kept).toEqual([{ from: 2, to: 5 }]);

    await dragAcross(250, 260);
    expect(value()).toHaveTextContent('only 3');
    expect(kept.at(-1)).toEqual({ from: 3, to: 3 });
  });

  it('holds a dragged range after the finger lifts until the range is kept, never the old one between', async () => {
    await draw(5, 5, true);

    await dragAcross(450, 250);
    expect(value()).toHaveTextContent('from 3 to 5');
    expect(bar(3)).toBeSelected();
    await finish();
    expect(value()).toHaveTextContent('from 3 to 5');
    expect(kept).toEqual([{ from: 3, to: 5 }]);
  });

  it('shows a tapped range at once and taps again from it before it is kept', async () => {
    await draw(1, 5, true);

    await tap(2);
    expect(value()).toHaveTextContent('from 2 to 5');
    expect(bar(1)).not.toBeSelected();
    await tap(4);
    expect(value()).toHaveTextContent('from 2 to 4');
    await finish();
    expect(value()).toHaveTextContent('from 2 to 4');
    expect(kept).toEqual([
      { from: 2, to: 5 },
      { from: 2, to: 4 },
    ]);
  });
});
