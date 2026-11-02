import { BadgeStamp, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import { testStrings } from '../test-strings';

async function draw(reduceMotion: boolean, onClose: () => void) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <BadgeStamp
        condition={{ kind: 'streak', days: 7 }}
        symbol="7"
        name="A week"
        title="Yours!"
        takeLabel="Take"
        mascot={<Text testID="mascot">mascot</Text>}
        onClose={onClose}
      />
    </EditionProvider>,
  );
}

describe('BadgeStamp', () => {
  it.each([false, true])(
    'stamps the Badge with its symbol, name and the Mascot (Reduce Motion %s)',
    async (reduceMotion) => {
      await draw(reduceMotion, () => undefined);
      expect(screen.getByTestId('badge-stamp-mark-symbol')).toHaveTextContent('7');
      expect(screen.getByText('Yours!')).toBeOnTheScreen();
      expect(screen.getByText('A week')).toBeOnTheScreen();
      expect(screen.getByTestId('mascot')).toBeOnTheScreen();
    },
  );

  it('closes on its take button', async () => {
    const onClose = jest.fn();
    await draw(false, onClose);
    await fireEvent.press(screen.getByTestId('badge-stamp-take'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
