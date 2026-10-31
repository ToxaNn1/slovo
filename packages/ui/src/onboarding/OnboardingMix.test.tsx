import { EditionProvider, OnboardingMix } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const strings = testStrings({
  splash: { wordmark: 'SLOVO' },
  onboarding: {
    skip: 'Skip',
    step: 'STEP {step} OF {total}',
    stepLabel: 'Step {step} of {total}',
    mix: { title: 'Choose your Mix', subtitle: 'What the Feed shows', next: 'Next' },
  },
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function renderMix() {
  const handlers = { onNext: jest.fn(), onSkip: jest.fn() };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <OnboardingMix step={2} total={4} {...handlers}>
          <Text>The choices</Text>
        </OnboardingMix>
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return handlers;
}

describe('OnboardingMix', () => {
  it('shows its number, its title and subtitle, and the choices it is given', async () => {
    await renderMix();

    expect(screen.getByText('STEP 2 OF 4')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Choose your Mix' })).toBeTruthy();
    expect(screen.getByText('What the Feed shows')).toBeTruthy();
    expect(screen.getByText('The choices')).toBeTruthy();
  });

  it('goes on on «next» and finishes on «skip»', async () => {
    const { onNext, onSkip } = await renderMix();

    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
