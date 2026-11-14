import { EditionProvider, OptionSampleNumber, OptionScreen } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { testStrings } from '../test-strings';

const explanations: Record<string, string> = {
  few: 'A few a day.',
  many: 'Many a day.',
};

function Pace({ onBack = () => undefined }: { onBack?: () => void }) {
  const [chosen, setChosen] = useState('few');
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <OptionScreen
        testID="pace"
        title="Pace"
        subtitle="How fast to go."
        back={{ label: 'Settings', onPress: onBack, testID: 'pace-back' }}
        sample={<OptionSampleNumber value={chosen === 'few' ? '3' : '9'} />}
        explanation={explanations[chosen] ?? ''}
        options={[
          { value: 'few', label: 'Few', testID: 'pace-few' },
          { value: 'many', label: 'Many', testID: 'pace-many' },
        ]}
        selected={chosen}
        onSelect={setChosen}
      />
    </EditionProvider>
  );
}

describe('OptionScreen', () => {
  it('shows its title, subtitle, sample and the explaining line of the chosen option', async () => {
    await render(<Pace />);
    expect(screen.getByRole('header', { name: 'Pace' })).toBeOnTheScreen();
    expect(screen.getByText('How fast to go.')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen();
    expect(screen.getByText('A few a day.')).toBeOnTheScreen();
    expect(screen.getByTestId('pace-few')).toBeSelected();
    expect(screen.getByTestId('pace-many')).not.toBeSelected();
  });

  it('chooses an option on a tap, which marks it and changes the sample and the line', async () => {
    await render(<Pace />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Many' }));
    expect(screen.getByTestId('pace-many')).toBeSelected();
    expect(screen.getByTestId('pace-few')).not.toBeSelected();
    expect(screen.getByText('9')).toBeOnTheScreen();
    expect(screen.getByText('Many a day.')).toBeOnTheScreen();
  });

  it('goes back from its back tile, named by the screen it returns to', async () => {
    let backs = 0;
    await render(
      <Pace
        onBack={() => {
          backs += 1;
        }}
      />,
    );
    await fireEvent.press(screen.getByLabelText('Settings'));
    expect(backs).toBe(1);
  });
});
