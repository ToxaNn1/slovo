import { EditionProvider, QuietScreenHero, QuietScreenRow, ReduceMotionProvider } from '@slovo/ui';
import type { EntryRowModel } from '@slovo/core';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function tree(children: ReactNode) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'uk' }} strings={testStrings({})}>
        {children}
      </EditionProvider>
    </SafeAreaProvider>
  );
}

const row: EntryRowModel = {
  kind: 'word',
  entryId: 'w1',
  title: 'ле́тьмище',
  secondLine: 'Темрява, морок.',
  labelKey: 'word',
  spoken: 'летьмище. Темрява, морок.',
  partOfSpeech: 'noun',
  gender: 'neuter',
  registers: [],
  rarity: 4,
};

describe('QuietScreenHero', () => {
  it('shows the label, the name as a header and the description, and goes back', async () => {
    const back = { label: 'Home', onPress: jest.fn() };
    await render(
      tree(
        <QuietScreenHero
          id="hero"
          label="Категорія"
          title="Розстріляна лексика"
          description="Повертаємо їх тихо."
          back={back}
        />,
      ),
    );

    expect(screen.getByTestId('hero-label')).toHaveTextContent('Категорія');
    expect(screen.getByRole('header', { name: 'Розстріляна лексика' })).toBeTruthy();
    expect(screen.getByTestId('hero-description')).toHaveTextContent('Повертаємо їх тихо.');
    expect(screen.getByTestId('mascot-hatOff')).toBeTruthy();
    // No right button and no progress: the back button is the hero's only one.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByTestId('hero-progress')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Home' }));

    expect(back.onPress).toHaveBeenCalledTimes(1);
  });
});

async function renderRow(index: number, reduceMotion = false) {
  const onPress = jest.fn();
  await render(
    <ReduceMotionProvider reduceMotion={reduceMotion}>
      {tree(<QuietScreenRow testID="row" row={row} index={index} onPress={onPress} />)}
    </ReduceMotionProvider>,
  );
  return onPress;
}

function opacity() {
  return (getAnimatedStyle(screen.getByTestId('row-fade')) as { opacity?: number }).opacity ?? 1;
}

async function wait(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('QuietScreenRow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the word without its Stress and the short Definition, and opens the Entry', async () => {
    const onPress = await renderRow(0);

    expect(screen.getByText('летьмище')).toBeTruthy();
    expect(screen.getByText('Темрява, морок.')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'летьмище. Темрява, морок.' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('fades in over 0.6 s, 120 ms after the row before it', async () => {
    await renderRow(2);

    await wait(240);
    expect(opacity()).toBe(0);
    await wait(600);
    expect(opacity()).toBe(1);
  });

  it('fades in at once under Reduce Motion, whatever its place', async () => {
    await renderRow(5, true);

    await wait(300);
    expect(opacity()).toBe(1);
  });
});
