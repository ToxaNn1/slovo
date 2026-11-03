import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { coreTokens, typeStyle } from '../tokens';
import { WholeWordsText } from './WholeWordsText';

describe('WholeWordsText', () => {
  it('gives a capital mark room at the size it draws a word role at', async () => {
    // The hero word, 50 on a 50-point line, drawn at 58 on a 58-point line:
    // Ї needs 1.255 × 58 = 72.8 points, so 15 above the line.
    await render(
      <WholeWordsText
        testID="word"
        text="Hedgehog"
        typeRole="heroWord"
        size={{ fontSize: 58, lineHeight: 58 }}
        style={typeStyle('heroWord', coreTokens)}
      />,
    );
    expect(screen.getByTestId('word')).toHaveStyle({ paddingTop: 15, marginTop: -15 });
  });

  it('adds no room when the line already holds the marks', async () => {
    // The Lemma's own line, 1.3 × its size, already clears the marks.
    await render(
      <WholeWordsText
        testID="word"
        text="Hedgehog"
        typeRole="heroWord"
        size={{ fontSize: 58, lineHeight: 75.4 }}
        style={typeStyle('heroWord', coreTokens)}
      />,
    );
    expect(screen.getByTestId('word')).toHaveStyle({ paddingTop: 0, marginTop: 0 });
  });
});
