import { EditionProvider, Stepper } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { testStrings } from '../test-strings';

function Days({ initial }: { initial: number }) {
  const [value, setValue] = useState(initial);
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <Stepper
        testID="days"
        accessibilityLabel="Days"
        fewerLabel="Fewer days"
        moreLabel="More days"
        value={value}
        min={1}
        max={7}
        onChange={setValue}
      />
    </EditionProvider>
  );
}

describe('Stepper', () => {
  it('counts down to 1 and no further', async () => {
    await render(<Days initial={2} />);
    await fireEvent.press(screen.getByLabelText('Fewer days'));
    expect(screen.getByTestId('days-value')).toHaveTextContent('1');
    await fireEvent.press(screen.getByLabelText('Fewer days'));
    expect(screen.getByTestId('days-value')).toHaveTextContent('1');
    expect(screen.getByLabelText('Fewer days')).toBeDisabled();
    expect(screen.getByLabelText('More days')).toBeEnabled();
  });

  it('counts up to 7 and no further', async () => {
    await render(<Days initial={6} />);
    await fireEvent.press(screen.getByLabelText('More days'));
    expect(screen.getByTestId('days-value')).toHaveTextContent('7');
    await fireEvent.press(screen.getByLabelText('More days'));
    expect(screen.getByTestId('days-value')).toHaveTextContent('7');
    expect(screen.getByLabelText('More days')).toBeDisabled();
    expect(screen.getByLabelText('Fewer days')).toBeEnabled();
  });
});
