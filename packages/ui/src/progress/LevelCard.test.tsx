import { EditionProvider, LevelCard } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { testStrings } from '../test-strings';

async function draw(reduceMotion: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <LevelCard
        testID="level"
        level={7}
        progress={640}
        toNext={1000}
        lines={[
          { testID: 'level-name', text: 'Level 7 · Catcher' },
          { testID: 'level-xp', text: '640 of 1000 XP' },
        ]}
      />
    </EditionProvider>,
  );
}

describe('LevelCard', () => {
  it.each([false, true])('shows the Level in its ring and the lines beside it (Reduce Motion %s)', async (reduceMotion) => {
    await draw(reduceMotion);
    expect(screen.getByTestId('level-number')).toHaveTextContent('7');
    expect(screen.getByTestId('level-name')).toHaveTextContent('Level 7 · Catcher');
    expect(screen.getByTestId('level-xp')).toHaveTextContent('640 of 1000 XP');
  });
});
