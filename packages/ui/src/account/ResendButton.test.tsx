import type { EditionStrings } from '@slovo/contracts';
import { EditionProvider, ResendButton } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const strings = {
  account: {
    resend: 'Send again',
    resendIn: { one: 'Send again in {count} second', other: 'Send again in {count} seconds' },
  },
} as unknown as EditionStrings;

const SENT = new Date('2026-10-17T09:00:00Z');

async function renderButton(onPress: () => void = jest.fn()) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <ResendButton
        testID="resend"
        resendAt={new Date(SENT.getTime() + 60_000)}
        now={() => new Date()}
        onPress={onPress}
      />
    </EditionProvider>,
  );
}

async function passTime(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

describe('ResendButton', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: SENT });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('counts the seconds down, in their plural form, and takes no press meanwhile', async () => {
    const onPress = jest.fn();
    await renderButton(onPress);
    expect(screen.getByTestId('resend')).toHaveTextContent('Send again in 60 seconds');

    await passTime(1000);
    expect(screen.getByTestId('resend')).toHaveTextContent('Send again in 59 seconds');
    await passTime(58_000);
    expect(screen.getByTestId('resend')).toHaveTextContent('Send again in 1 second');

    await fireEvent.press(screen.getByTestId('resend'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('resend')).toBeDisabled();
  });

  it('sends again once the minute is over', async () => {
    const onPress = jest.fn();
    await renderButton(onPress);

    await passTime(60_000);
    const button = screen.getByRole('button', { name: 'Send again' });
    await fireEvent.press(button);

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('leaves no timer behind when its screen goes away', async () => {
    await renderButton();

    await passTime(1000);
    await screen.unmount();
    await passTime(1000);

    expect(jest.getTimerCount()).toBe(0);
  });
});
