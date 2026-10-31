import type { Rarity } from '@slovo/contracts';
import { EditionProvider, OnboardingRarityTest, type RarityTestQuestion } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const strings = testStrings({
  splash: { wordmark: 'SLOVO' },
  onboarding: {
    skip: 'Skip',
    step: 'STEP {step} OF {total}',
    stepLabel: 'Step {step} of {total}',
    welcome: { start: 'Start' },
    mix: { next: 'Next' },
    notifications: { later: 'Later' },
  },
  rarityTest: {
    start: 'Check your level',
    subtitle: 'A few words to pick your rarity',
    progress: '{n} of {total}',
    result: 'Your level: from {n}',
  },
  knowledge: { known: 'Known', unknown: 'Unknown' },
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/** Two Words of each of the rarities 1 to 3, the commonest first. */
const words: RarityTestQuestion[] = ([1, 1, 2, 2, 3, 3] as const).map((rarity, index) => ({
  rarity,
  lemma: `word${String(index)}`,
  accessibilityLabel: `word ${String(index)}`,
}));

async function renderStep(props: Partial<Parameters<typeof OnboardingRarityTest>[0]> = {}) {
  const handlers = {
    onApply: jest.fn((): Promise<Rarity | undefined> => Promise.resolve(2)),
    onNext: jest.fn(),
    onSkip: jest.fn(),
  };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <OnboardingRarityTest step={3} total={4} words={words} {...handlers} {...props} />
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return handlers;
}

describe('OnboardingRarityTest', () => {
  it('offers the test as a step of the onboarding', async () => {
    await renderStep();

    expect(screen.getByRole('header', { name: 'Check your level' })).toBeTruthy();
    expect(screen.getByText('A few words to pick your rarity')).toBeTruthy();
    expect(screen.getByText('STEP 3 OF 4')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
  });

  it('goes on past the test on «later», asking nothing and setting nothing', async () => {
    const { onApply, onNext, onSkip } = await renderStep();

    await fireEvent.press(screen.getByRole('button', { name: 'Later' }));

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('finishes the onboarding on «skip», also halfway through the test', async () => {
    const { onApply, onSkip } = await renderStep();
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));

    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('asks about each Word in turn, the commonest first, by its Lemma with Stress', async () => {
    await renderStep();
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByLabelText('word 0')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Known' }));

    expect(screen.getByLabelText('word 1')).toBeTruthy();
    expect(screen.queryByLabelText('word 0')).toBeNull();
  });

  it('counts the Words asked about, out of all of them', async () => {
    await renderStep();
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByText('1 of 6')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Unknown' }));

    expect(screen.getByText('2 of 6')).toBeTruthy();
    expect(screen.queryByText('1 of 6')).toBeNull();
  });

  it('sets the floor by a full test and shows it on the result, then goes on', async () => {
    const { onApply, onNext } = await renderStep();
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));

    for (const known of [true, true, true, false, false, true]) {
      await fireEvent.press(screen.getByRole('button', { name: known ? 'Known' : 'Unknown' }));
    }

    expect(onApply).toHaveBeenCalledWith([
      { rarity: 1, known: true },
      { rarity: 1, known: true },
      { rarity: 2, known: true },
      { rarity: 2, known: false },
      { rarity: 3, known: false },
      { rarity: 3, known: true },
    ]);
    expect(await screen.findByRole('header', { name: 'Your level: from 2' })).toBeTruthy();
    expect(onNext).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('goes on without a result when no floor was set, as with the test switched off meanwhile', async () => {
    const { onNext } = await renderStep({ onApply: jest.fn(() => Promise.resolve(undefined)) });
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));

    for (const _ of words) {
      await fireEvent.press(screen.getByRole('button', { name: 'Known' }));
    }

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Your level/)).toBeNull();
  });
});
