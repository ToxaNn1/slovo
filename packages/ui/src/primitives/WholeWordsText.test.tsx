import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

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

  it('keeps a phrase to its lines and a single word to one, shrinking rather than breaking', async () => {
    await render(
      <>
        <WholeWordsText
          testID="phrase"
          text="Take part"
          typeRole="heroWord"
          lines={3}
          style={typeStyle('heroWord', coreTokens)}
        />
        <WholeWordsText
          testID="word"
          text="Hedgehog"
          typeRole="heroWord"
          lines={3}
          style={typeStyle('heroWord', coreTokens)}
        />
      </>,
    );
    expect(screen.getByTestId('phrase').props).toMatchObject({
      numberOfLines: 3,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.5,
    });
    expect(screen.getByTestId('word').props).toMatchObject({
      numberOfLines: 1,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.5,
    });
  });

  // A view that hugs its text, as the struck form's does, is as wide as the word:
  // shrinking it there would narrow the view and shrink the word again, to nothing.
  it('keeps its size when the widest word fits the line exactly', async () => {
    await render(
      <WholeWordsText
        testID="word"
        text="Hedgehog"
        typeRole="heroWord"
        style={typeStyle('heroWord', coreTokens)}
      />,
    );
    const shown = screen.getByTestId('word');
    const line = shown.parent;
    if (line === null) throw new Error('The word has no line around it');
    await fireEvent(line, 'layout', { nativeEvent: { layout: { width: 240 } } });
    const measured = screen
      .getAllByText('Hedgehog', { includeHiddenElements: true })
      .find((element) => element !== shown);
    if (measured === undefined) throw new Error('The word is not measured');
    await fireEvent(measured, 'textLayout', { nativeEvent: { lines: [{ width: 240 }] } });

    expect(screen.getByTestId('word')).toHaveStyle({ fontSize: 50 });
  });
});
