import { DailyCrosswordCard, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

describe('DailyCrosswordCard', () => {
  it('reads its label in the Edition’s language', async () => {
    await render(
      <EditionProvider edition={{ locale: 'uk' }} strings={testStrings({})}>
        <DailyCrosswordCard
          title="Daily crossword"
          day="26 October"
          state="Start"
          solved={false}
          grid={[[{ kind: 'cell', letter: 'A' }, { kind: 'block' }]]}
          onPress={jest.fn()}
          testID="card"
        />
      </EditionProvider>,
    );

    const tile = screen.getByRole('button');
    expect(tile.props['accessibilityLabel']).toBe('Daily crossword. 26 October. Start');
    expect(tile.props['accessibilityLanguage']).toBe('uk');
  });
});
