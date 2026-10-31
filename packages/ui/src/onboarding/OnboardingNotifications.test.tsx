import { EditionProvider, OnboardingNotifications, type SampleNotificationLook } from '@slovo/ui';
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
    notifications: {
      title: 'The word comes to you',
      subtitle: 'Once a day',
      sample: 'Sample notification',
      allow: 'Allow notifications',
      later: 'Later',
    },
  },
});

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const sample: SampleNotificationLook = {
  lemma: 'hori\u0301zon',
  accessibilityLabel: 'horizon, stress on i',
  body: 'The line where the sky meets the earth.',
  time: '09:00',
};

async function renderNotifications(look: SampleNotificationLook | undefined) {
  const handlers = { onAllow: jest.fn(), onLater: jest.fn(), onSkip: jest.fn() };
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <OnboardingNotifications step={4} total={4} sample={look} {...handlers}>
          <Text>The times</Text>
        </OnboardingNotifications>
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return handlers;
}

describe('OnboardingNotifications', () => {
  it('shows its title, the times it is given and a sample read as one notification', async () => {
    await renderNotifications(sample);

    expect(screen.getByText('STEP 4 OF 4')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'The word comes to you' })).toBeTruthy();
    expect(screen.getByText('Once a day')).toBeTruthy();
    expect(screen.getByText('The times')).toBeTruthy();
    expect(
      screen.getByLabelText(
        'Sample notification. SLOVO. 09:00. horizon, stress on i. The line where the sky meets the earth.',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('onboarding-sample-time')).toHaveTextContent('09:00');
  });

  it('leaves the time out of a sample with no Notification time', async () => {
    await renderNotifications({ ...sample, time: undefined });

    expect(screen.queryByTestId('onboarding-sample-time')).toBeNull();
    expect(
      screen.getByLabelText(
        'Sample notification. SLOVO. horizon, stress on i. The line where the sky meets the earth.',
      ),
    ).toBeTruthy();
  });

  it('leaves the sample out when there is none to show', async () => {
    await renderNotifications(undefined);

    expect(screen.queryByTestId('onboarding-sample')).toBeNull();
  });

  it('asks to allow on «allow» and goes on without on «later»', async () => {
    const { onAllow, onLater, onSkip } = await renderNotifications(sample);

    await fireEvent.press(screen.getByRole('button', { name: 'Allow notifications' }));

    expect(onAllow).toHaveBeenCalledTimes(1);
    expect(onLater).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Later' }));

    expect(onLater).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });
});
