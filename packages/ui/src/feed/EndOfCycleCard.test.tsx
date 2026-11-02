import { EditionProvider, EndOfCycleCard } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  endOfCycle: { title: 'You have seen every word', message: 'Swipe on to start again.' },
});

describe('the end-of-Cycle card', () => {
  it('shows the waiting Mascot over its title and text, which VoiceOver reads as one element', async () => {
    await render(
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <EndOfCycleCard />
      </EditionProvider>,
    );

    expect(screen.getByTestId('mascot-waits')).toBeTruthy();
    expect(screen.getByText('You have seen every word')).toBeTruthy();
    expect(screen.getByText('Swipe on to start again.')).toBeTruthy();
    expect(
      screen.getByLabelText('You have seen every word. Swipe on to start again.'),
    ).toBeTruthy();
  });
});
