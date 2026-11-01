import { EditionProvider, OnboardingAccount } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const ACCOUNT_NAME = 'Test ID';

const strings = testStrings({
  splash: { wordmark: 'SLOVO' },
  onboarding: {
    skip: 'Skip',
    step: 'STEP {step} OF {total}',
    stepLabel: 'Step {step} of {total}',
    account: {
      title: 'Keep your words',
      subtitle: '{name} keeps them',
      signIn: 'Sign in with {name}',
      continueWithout: 'Continue without an account',
    },
  },
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

async function renderAccount() {
  const handlers = { onSignIn: jest.fn(), onContinue: jest.fn(), onSkip: jest.fn() };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <OnboardingAccount step={5} total={5} accountName={ACCOUNT_NAME} {...handlers} />
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return handlers;
}

describe('OnboardingAccount', () => {
  it('shows its title and what the Account keeps, under its name', async () => {
    await renderAccount();

    expect(screen.getByText('STEP 5 OF 5')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Keep your words' })).toBeTruthy();
    expect(screen.getByText(`${ACCOUNT_NAME} keeps them`)).toBeTruthy();
    expect(screen.getByText(`Sign in with ${ACCOUNT_NAME}`)).toBeTruthy();
  });

  it('signs in on «sign in» and goes on without on «continue»', async () => {
    const { onSignIn, onContinue, onSkip } = await renderAccount();

    await fireEvent.press(screen.getByTestId('onboarding-sign-in'));

    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Continue without an account' }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });
});
