import { BadgeStamp, EditionProvider, ReduceMotionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { testStrings } from '../test-strings';

/** The stamp, with «Менше руху» on or off. */
async function draw(reduceMotion: boolean, onClose: () => void) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <ReduceMotionProvider reduceMotion={reduceMotion}>
        <BadgeStamp
          shape="hexagon"
          symbol="7"
          name="A week"
          kicker="BADGE"
          line="A new Badge, yours for good."
          ribbon="YOURS NOW"
          doneLabel="DONE"
          mascot={<Text testID="mascot">mascot</Text>}
          onClose={onClose}
        />
      </ReduceMotionProvider>
    </EditionProvider>,
  );
}

describe('BadgeStamp', () => {
  it.each([false, true])(
    'stamps the Badge under the kicker with its name, the line, the Mascot and the ribbon (Reduce Motion %s)',
    async (reduceMotion) => {
      await draw(reduceMotion, () => undefined);
      expect(screen.getByText('BADGE')).toBeOnTheScreen();
      expect(screen.getByTestId('badge-stamp-mark-symbol')).toHaveTextContent('7');
      expect(screen.getByRole('header', { name: 'A week' })).toBeOnTheScreen();
      expect(screen.getByText('A new Badge, yours for good.')).toBeOnTheScreen();
      expect(screen.getByTestId('mascot')).toBeOnTheScreen();
      expect(screen.getByText('YOURS NOW')).toBeOnTheScreen();
    },
  );

  it('strikes with an ink burst, and under Reduce Motion only fades in', async () => {
    await draw(false, () => undefined);
    expect(screen.getByTestId('badge-stamp-burst')).toBeOnTheScreen();
    screen.unmount();
    await draw(true, () => undefined);
    expect(screen.queryByTestId('badge-stamp-burst')).toBeNull();
  });

  it('closes on «ГОТОВО», which comes in after the ribbon', async () => {
    const onClose = jest.fn();
    await draw(false, onClose);
    // Jest runs no frames, and the query reads the button's opacity before them.
    await fireEvent.press(screen.getByTestId('badge-stamp-done', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
