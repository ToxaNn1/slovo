import { ChipChoice, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { testStrings } from '../test-strings';

async function renderInEdition(choice: ReactElement) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      {choice}
    </EditionProvider>,
  );
}

const options = [
  { value: 'off', label: 'Never' },
  { value: 20, label: 'Rarely' },
  { value: 10, label: 'Sometimes' },
] as const;

function choice(overrides: Partial<Parameters<typeof ChipChoice<'off' | 20 | 10>>[0]> = {}) {
  return (
    <ChipChoice<'off' | 20 | 10>
      testID="mix-quick-question"
      title="Quick Question"
      subtitle="How often the Feed asks"
      options={options}
      value={20}
      onChange={() => undefined}
      {...overrides}
    />
  );
}

describe('ChipChoice', () => {
  it('offers every option under its title and marks the one chosen', async () => {
    await renderInEdition(choice({ value: 10 }));

    expect(screen.getByRole('header', { name: 'Quick Question' })).toBeTruthy();
    for (const { value, label } of options) {
      expect(
        screen.getByRole('button', { name: label, selected: value === 10, disabled: false }),
      ).toBeTruthy();
    }
  });

  it('asks for the option the reader taps', async () => {
    const onChange = jest.fn();
    await renderInEdition(choice({ onChange }));

    await fireEvent.press(screen.getByTestId('mix-quick-question-off'));

    expect(onChange).toHaveBeenCalledWith('off');
  });
});
