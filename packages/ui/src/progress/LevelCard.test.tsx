import {
  coreTokens,
  EditionProvider,
  LevelCard,
  TokensProvider,
  type ColorScheme,
} from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { testStrings } from '../test-strings';

async function draw(reduceMotion: boolean, colorScheme: ColorScheme = 'light') {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
  await render(
    <TokensProvider tokens={coreTokens} colorScheme={colorScheme}>
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <LevelCard
          testID="level"
          number={7}
          label="Level"
          name="Catcher"
          progress={640}
          toNext={1000}
          lines={[
            { testID: 'level-xp', text: '640 of 1000 XP' },
            { testID: 'level-total', text: 'All XP: 2400' },
          ]}
        />
      </EditionProvider>
    </TokensProvider>,
  );
}

describe('LevelCard', () => {
  it.each([false, true])(
    'shows the Level and its label in its ring, its name and the lines beside it (Reduce Motion %s)',
    async (reduceMotion) => {
      await draw(reduceMotion);
      expect(screen.getByTestId('level-number')).toHaveTextContent('7');
      expect(screen.getByText('Level')).toBeOnTheScreen();
      expect(screen.getByTestId('level-name')).toHaveTextContent('Catcher');
      expect(screen.getByTestId('level-xp')).toHaveTextContent('640 of 1000 XP');
      expect(screen.getByTestId('level-total')).toHaveTextContent('All XP: 2400');
    },
  );

  // ADR 0188: the card stands on the Theme's tile, not as an inverted ink patch.
  it.each(['light', 'dark'] as const)(
    'takes the tile surface and the ink text of the %s Theme',
    async (colorScheme) => {
      const colors = coreTokens.colors[colorScheme];
      await draw(true, colorScheme);
      expect(screen.getByTestId('level')).toHaveStyle({ backgroundColor: colors.tile });
      expect(screen.getByTestId('level-number')).toHaveStyle({ color: colors.ink });
      expect(screen.getByTestId('level-name')).toHaveStyle({ color: colors.ink });
      expect(screen.getByTestId('level-xp')).toHaveStyle({ color: colors.ink });
    },
  );
});
