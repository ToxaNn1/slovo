import type { EditionStrings } from '@slovo/contracts';
import { EditionProvider, OnboardingWelcome, type HeroWord } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const strings = {
  splash: { wordmark: 'SLOVO' },
  onboarding: {
    skip: 'Skip',
    step: 'STEP {step} OF {total}',
    stepLabel: 'Step {step} of {total}',
    welcome: { start: 'Start', title: 'Rare words', subtitle: 'One a day' },
  },
} as unknown as EditionStrings;

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const hero: HeroWord = {
  lemma: 'hori\u0301zon',
  accessibilityLabel: 'horizon, stress on i',
  definition: 'The line where the sky meets the earth.',
};

async function renderWelcome(word: HeroWord | undefined) {
  const handlers = { onStart: jest.fn(), onSkip: jest.fn() };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <OnboardingWelcome step={1} total={4} hero={word} {...handlers} />
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return handlers;
}

describe('OnboardingWelcome', () => {
  it('shows the hero Word with its Definition, the promise and the first page dot', async () => {
    await renderWelcome(hero);

    expect(screen.getByLabelText('horizon, stress on i')).toBeTruthy();
    expect(screen.getByText('The line where the sky meets the earth.')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Rare words' })).toBeTruthy();
    expect(screen.getByText('One a day')).toBeTruthy();
    expect(screen.getByLabelText('Step 1 of 4')).toBeTruthy();
    expect(screen.queryByText('STEP 1 OF 4')).toBeNull();
  });

  it('leaves the hero Word out when there is none to show', async () => {
    await renderWelcome(undefined);

    expect(screen.queryByTestId('onboarding-hero-lemma')).toBeNull();
    expect(screen.queryByTestId('onboarding-hero-definition')).toBeNull();
    expect(screen.getByRole('header', { name: 'Rare words' })).toBeTruthy();
  });

  it('starts on «start» and finishes on «skip»', async () => {
    const { onStart, onSkip } = await renderWelcome(hero);

    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
