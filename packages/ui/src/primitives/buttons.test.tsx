import {
  Button,
  coreTokens,
  EditionProvider,
  GoogleSignInButton,
  InterfaceSoundsProvider,
  TokensProvider,
} from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import { testStrings } from '../test-strings';

function Edition({ children }: { children: ReactNode }) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      {children}
    </EditionProvider>
  );
}

describe.each([
  ['Button', Button],
  ['GoogleSignInButton', GoogleSignInButton],
])('%s', (_, Subject) => {
  it('acts on a press', async () => {
    const onPress = jest.fn();
    await render(
      <Edition>
        <Subject label="Send the code" onPress={onPress} />
      </Edition>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Send the code' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('reads its label in the language of the Edition', async () => {
    await render(
      <Edition>
        <Subject label="Send the code" onPress={() => undefined} />
      </Edition>,
    );

    expect(screen.getByRole('button', { name: 'Send the code' })).toHaveProp(
      'accessibilityLanguage',
      'en',
    );
  });

  it('shows that it is busy and takes no press until its request is answered', async () => {
    const onPress = jest.fn();
    await render(
      <Edition>
        <Subject label="Send the code" onPress={onPress} busy />
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
        <Subject label="Send the code" onPress={onPress} disabled />
      </Edition>,
    );

    const button = screen.getByRole('button', { name: 'Send the code' });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });
});

describe('Button with a mark', () => {
  it('draws the mark before the label, and VoiceOver reads the label alone', async () => {
    const onPress = jest.fn();
    await render(
      <Edition>
        <Button label="Sign in" mark={<Text testID="mark">S</Text>} onPress={onPress} />
      </Edition>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('mark')).toBeOnTheScreen();
  });
});

describe('Button and the Interface sounds', () => {
  it('asks for the tap sound on a press, and for none while disabled', async () => {
    const play = jest.fn();
    await render(
      <Edition>
        <InterfaceSoundsProvider sounds={{ play }}>
          <Button label="Go" onPress={jest.fn()} />
          <Button label="Stop" onPress={jest.fn()} disabled />
        </InterfaceSoundsProvider>
      </Edition>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Stop' }));
    expect(play).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
    expect(play.mock.calls).toEqual([['tap']]);
  });
});

describe('Button with a capital mark in its label', () => {
  it('draws a capital with a mark above it whole and keeps the label’s line where it was', async () => {
    await render(
      <Edition>
        <Button label="Language gourmet" onPress={jest.fn()} />
      </Edition>,
    );

    const style = StyleSheet.flatten(
      screen.getByText('Language gourmet').props['style'],
    ) as TextStyle;
    const { paddingTop = 0, marginTop = 0, fontSize = 0, lineHeight = 0 } = style;
    // Й's breve rises 0.987 em above the baseline; iOS keeps 0.245 em of the line below it.
    expect(Number(paddingTop) + lineHeight - 0.245 * fontSize).toBeGreaterThanOrEqual(
      0.987 * fontSize,
    );
    expect(Number(paddingTop) + Number(marginTop)).toBe(0);
  });
});

describe('Button of the inverse variant', () => {
  it("draws the Theme's background on its label, so it turns with the Theme", async () => {
    await render(
      <TokensProvider tokens={coreTokens} colorScheme="dark">
        <Edition>
          <Button variant="inverse" label="Try again" onPress={jest.fn()} />
        </Edition>
      </TokensProvider>,
    );

    const style = StyleSheet.flatten(screen.getByText('Try again').props['style']) as TextStyle;
    expect(style.color).toBe(coreTokens.colors.dark.background);
  });
});
