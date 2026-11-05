import { EditionProvider, GesturesHintSheet } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { testStrings } from '../test-strings';

const texts = {
  title: 'SWIPE',
  rows: {
    known: { title: 'Right', body: 'I know it' },
    unknown: { title: 'Left', body: 'I do not know it' },
    next: { title: 'Up', body: 'Next card' },
  },
  dismiss: 'GOT IT',
};

async function draw({
  reduceMotion = false,
  onShown = () => undefined,
  onDismiss = () => undefined,
}: {
  reduceMotion?: boolean;
  onShown?: () => void;
  onDismiss?: () => void;
}) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <GesturesHintSheet visible texts={texts} onShown={onShown} onDismiss={onDismiss} />
    </EditionProvider>,
  );
}

describe('GesturesHintSheet', () => {
  it('shows its title and a row per gesture: right, left, up', async () => {
    await draw({});
    expect(screen.getByText('SWIPE')).toBeOnTheScreen();
    expect(screen.getByTestId('gestures-hint-known')).toHaveTextContent(/Right.*I know it/);
    expect(screen.getByTestId('gestures-hint-unknown')).toHaveTextContent(/Left.*I do not know it/);
    expect(screen.getByTestId('gestures-hint-next')).toHaveTextContent(/Up.*Next card/);
  });

  it('asks onDismiss on «ЗРОЗУМІЛО»', async () => {
    const onDismiss = jest.fn();
    await draw({ onDismiss });
    expect(onDismiss).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('gestures-hint-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onShown once it is drawn', async () => {
    const onShown = jest.fn();
    await draw({ onShown });
    expect(onShown).toHaveBeenCalledTimes(1);
  });

  it('plays the finger over the card', async () => {
    await draw({ reduceMotion: false });
    expect(screen.getByTestId('gestures-hint-finger')).toBeOnTheScreen();
  });

  it('draws no finger with Reduce Motion', async () => {
    await draw({ reduceMotion: true });
    expect(screen.getByTestId('gestures-hint')).toBeOnTheScreen();
    expect(screen.queryByTestId('gestures-hint-finger')).toBeNull();
  });
});
