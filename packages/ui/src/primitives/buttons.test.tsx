import type { EditionStrings } from '@slovo/contracts';
import { EditionProvider, PrimaryButton, SecondaryButton } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

function Edition({ children }: { children: ReactNode }) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={{} as EditionStrings}>
      {children}
    </EditionProvider>
  );
}

describe.each([
  ['PrimaryButton', PrimaryButton],
  ['SecondaryButton', SecondaryButton],
])('%s', (_, Button) => {
  it('acts on a press', async () => {
    const onPress = jest.fn();
    await render(
      <Edition>
        <Button label="Send the code" onPress={onPress} />
      </Edition>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Send the code' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('shows that it is busy and takes no press until its request is answered', async () => {
    const onPress = jest.fn();
    await render(
      <Edition>
        <Button label="Send the code" onPress={onPress} busy />
      </Edition>,
    );

    const button = screen.getByRole('button', { name: 'Send the code' });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
  });

  it('takes no press while it is disabled', async () => {
    const onPress = jest.fn();
    await render(
      <Edition>
        <Button label="Send the code" onPress={onPress} disabled />
      </Edition>,
    );

    const button = screen.getByRole('button', { name: 'Send the code' });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });
});
