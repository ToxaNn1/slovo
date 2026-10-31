import { EditionProvider, TextField } from '@slovo/ui';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { testStrings } from '../test-strings';

function Field({
  problem,
  cause,
  busy,
  onChangeText = jest.fn(),
}: {
  problem?: string;
  cause?: object;
  busy?: boolean;
  onChangeText?: (text: string) => void;
}) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <TextField
        testID="email"
        label="Email"
        value=""
        onChangeText={onChangeText}
        problem={problem}
        problemCause={cause}
        busy={busy}
      />
    </EditionProvider>
  );
}

describe('TextField', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('names the field by its label and passes on what the reader types', async () => {
    const onChangeText = jest.fn();
    await render(<Field onChangeText={onChangeText} />);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'anna@mail.com');

    expect(onChangeText).toHaveBeenCalledWith('anna@mail.com');
  });

  it('shows its problem in one line under the field and announces it to VoiceOver', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await render(<Field />);
    expect(screen.queryByTestId('email-problem')).toBeNull();

    await screen.rerender(<Field problem="Check the email." />);

    expect(screen.getByTestId('email-problem')).toHaveTextContent('Check the email.');
    expect(announce).toHaveBeenCalledWith('Check the email.');
  });

  it('announces the same problem again when it comes back after a new try', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await render(<Field problem="No connection." />);
    await screen.rerender(<Field busy />);
    announce.mockClear();

    await screen.rerender(<Field problem="No connection." />);

    expect(announce).toHaveBeenCalledWith('No connection.');
  });

  it('announces the same problem again for a new try that met it at once', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await render(<Field problem="Check the email." cause={{ try: 1 }} />);
    announce.mockClear();

    await screen.rerender(<Field problem="Check the email." cause={{ try: 2 }} />);

    expect(announce).toHaveBeenCalledWith('Check the email.');
  });

  it('takes no typing while its request is on the way, and says it is busy', async () => {
    const onChangeText = jest.fn();
    await render(<Field busy onChangeText={onChangeText} />);

    const field = screen.getByLabelText('Email');
    await fireEvent.changeText(field, '1');

    expect(onChangeText).not.toHaveBeenCalled();
    expect(field).toBeBusy();
  });
});
