import { EditionProvider, MistakeReportSheet } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { testStrings } from '../test-strings';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const strings = testStrings({
  mistakeReport: {
    action: 'Report a mistake',
    types: { typo: 'Typo', stress: 'Stress', definition: 'Definition', other: 'Other' },
    comment: 'Comment (optional)',
    send: 'Send',
    sent: 'Thanks!',
    tooMany: 'Too many today.',
  },
});

async function renderSheet(onSend = jest.fn(), onClose = jest.fn()) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <MistakeReportSheet visible onSend={onSend} onClose={onClose} />
      </EditionProvider>
    </SafeAreaProvider>,
  );
  return { onSend, onClose };
}

const send = () => screen.getByRole('button', { name: 'Send' });

describe('MistakeReportSheet', () => {
  it('offers the four types of mistake, none chosen, and «Send» disabled', async () => {
    await renderSheet();

    for (const name of ['Typo', 'Stress', 'Definition', 'Other']) {
      expect(screen.getByRole('radio', { name })).not.toBeChecked();
    }
    expect(send()).toBeDisabled();
  });

  it('is read by VoiceOver as a heading, the four types, the comment field once and «Send»', async () => {
    await renderSheet();

    expect(screen.getByRole('header', { name: 'Report a mistake' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Comment (optional)')).toBeOnTheScreen();
    // The field says its own name; the line over it is not read a second time.
    expect(screen.queryByText('Comment (optional)')).not.toBeOnTheScreen();
    expect(screen.getByText('Comment (optional)', { includeHiddenElements: true })).toBeTruthy();
  });

  it('sends the chosen type with the comment as typed', async () => {
    const { onSend } = await renderSheet();

    await fireEvent.press(screen.getByRole('radio', { name: 'Stress' }));
    await fireEvent.changeText(screen.getByLabelText('Comment (optional)'), ' On the second ');
    expect(screen.getByRole('radio', { name: 'Stress' })).toBeChecked();
    await fireEvent.press(send());

    expect(onSend).toHaveBeenCalledWith({ type: 'stress', comment: ' On the second ' });
  });

  it('sends a type with no comment, since the comment is optional', async () => {
    const { onSend } = await renderSheet();

    await fireEvent.press(screen.getByRole('radio', { name: 'Typo' }));
    await fireEvent.press(send());

    expect(onSend).toHaveBeenCalledWith({ type: 'typo', comment: '' });
  });

  it('keeps «Send» disabled for «Other» until the comment says something', async () => {
    const { onSend } = await renderSheet();

    await fireEvent.press(screen.getByRole('radio', { name: 'Other' }));
    expect(send()).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Comment (optional)'), '   ');
    expect(send()).toBeDisabled();
    await fireEvent.press(send());
    expect(onSend).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Comment (optional)'), 'The example is wrong');
    expect(send()).toBeEnabled();
  });

  it('counts the comment’s characters and stops at 500', async () => {
    const { onSend } = await renderSheet();

    expect(screen.getByText('0/500')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Comment (optional)'), 'abc');
    expect(screen.getByText('3/500')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Comment (optional)'), 'a'.repeat(520));
    expect(screen.getByText('500/500')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Definition' }));
    await fireEvent.press(send());

    expect(onSend).toHaveBeenCalledWith({ type: 'definition', comment: 'a'.repeat(500) });
  });

  it('starts afresh after a report is sent', async () => {
    await renderSheet();

    await fireEvent.press(screen.getByRole('radio', { name: 'Typo' }));
    await fireEvent.changeText(screen.getByLabelText('Comment (optional)'), 'abc');
    await fireEvent.press(send());

    expect(screen.getByRole('radio', { name: 'Typo' })).not.toBeChecked();
    expect(screen.getByText('0/500')).toBeOnTheScreen();
  });
  it('caps the comment field at four lines, so a long comment scrolls inside it', async () => {
    await renderSheet();

    const field = screen.getByLabelText('Comment (optional)');
    // Four lines of 20 pt at the text size React Native's Jest setup gives (2),
    // capped at 1.5 times, 12 pt of padding above and below, and a 1 pt border
    // each side: the letters grow up to 1.5 times, and the cap with them.
    expect(field).toHaveStyle({ maxHeight: 4 * 20 * 1.5 + 2 * 12 + 2 });
    expect(field).toHaveProp('maxFontSizeMultiplier', 1.5);
    expect(field).toHaveProp('scrollEnabled', true);
  });

  it('closes the keyboard on the return key «Done» instead of adding a line', async () => {
    await renderSheet();

    const field = screen.getByLabelText('Comment (optional)');
    expect(field).toHaveProp('returnKeyType', 'done');
    expect(field).toHaveProp('submitBehavior', 'blurAndSubmit');
  });

  it('closes the keyboard on a drag of the sheet and on a tap beside the field', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    const { onSend } = await renderSheet();

    const content = screen.getByTestId('mistake-report-content');
    expect(content).toHaveProp('keyboardDismissMode', 'on-drag');
    expect(content).toHaveProp('keyboardShouldPersistTaps', 'handled');
    await fireEvent.changeText(screen.getByLabelText('Comment (optional)'), 'Wrong stress');
    await fireEvent.press(within(content).getByRole('radio', { name: 'Stress' }));
    expect(dismiss).toHaveBeenCalledTimes(1);
    await fireEvent.press(send());
    expect(onSend).toHaveBeenCalledWith({ type: 'stress', comment: 'Wrong stress' });
    dismiss.mockRestore();
  });
});
