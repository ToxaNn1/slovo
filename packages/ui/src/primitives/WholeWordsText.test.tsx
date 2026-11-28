import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { FontSizeProvider } from '../providers/FontSizeProvider';
import { coreTokens, titleScale, typeRoles, typeStyle } from '../tokens';
import { WholeWordsText } from './WholeWordsText';

/** Lays the text's line out `width` wide. */
async function layOut(testID: string, width: number) {
  const line = screen.getByTestId(testID).parent;
  if (line === null) throw new Error('The text has no line around it');
  await fireEvent(line, 'layout', { nativeEvent: { layout: { width } } });
}

/** Reports the widest word, at the size the text is tried at, as `width` wide. */
async function measureWords(testID: string, width: number) {
  await fireEvent(
    screen.getByTestId(`${testID}-words`, { includeHiddenElements: true }),
    'textLayout',
    { nativeEvent: { lines: [{ width }] } },
  );
}

/** Reports the whole text, at the size it is tried at, as taking `count` lines. */
async function measureLines(testID: string, count: number) {
  await fireEvent(
    screen.getByTestId(`${testID}-lines`, { includeHiddenElements: true }),
    'textLayout',
    { nativeEvent: { lines: Array.from({ length: count }, () => ({ width: 100 })) } },
  );
}

describe('WholeWordsText', () => {
  it('gives a capital mark room at the size it draws a word role at', async () => {
    // The hero word, drawn at 58 on a 58-point line:
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
        size={{ fontSize: 51, lineHeight: 66.3 }}
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

    expect(screen.getByTestId('word')).toHaveStyle({ fontSize: 44 });
  });

  it('keeps the start size for a short word', async () => {
    await render(
      <WholeWordsText
        testID="word"
        text="Hedgehog"
        typeRole="heroWord"
        lines={2}
        stepped
        style={typeStyle('heroWord', coreTokens)}
      />,
    );
    await layOut('word', 300);
    await measureWords('word', 120);

    expect(screen.getByTestId('word')).toHaveStyle({ fontSize: 44 });
    expect(screen.getByTestId('word')).not.toHaveStyle({ opacity: 0 });
  });

  it('draws a word too wide for its line at the next lower step of the scale, never a fraction', async () => {
    await render(
      <WholeWordsText
        testID="word"
        text="Synchrophasotron"
        typeRole="heroWord"
        lines={2}
        stepped
        style={typeStyle('heroWord', coreTokens)}
      />,
    );
    await layOut('word', 300);
    // At 44 the word takes 320 of the line's 300: (300 − 1) / 320 of 44 would be 41.1.
    await measureWords('word', 320);
    expect(screen.getByTestId('word')).toHaveStyle({ opacity: 0 });
    // At 40 it takes 320 × 40 / 44 = 290.9, which fits.
    await measureWords('word', 290.9);

    const word = screen.getByTestId('word');
    expect(word).toHaveStyle({ fontSize: 40 });
    expect(word).not.toHaveStyle({ opacity: 0 });
    // A single word stays whole on its one line.
    expect(word.props).toMatchObject({ numberOfLines: 1 });
  });

  it('jumps to the step its widest word fits at in one measure, not a pass per step (27.11 pass)', async () => {
    await render(
      <WholeWordsText
        testID="word"
        text="Synchrophasotronically"
        typeRole="heroWord"
        lines={2}
        stepped
        style={typeStyle('heroWord', coreTokens)}
      />,
    );
    await layOut('word', 300);
    // At 44 the word takes 560: it fits at 300 / 560 × 44 = 23.6 or less, so at 22.
    await measureWords('word', 560);
    expect(screen.getByTestId('word')).toHaveStyle({ fontSize: 22, opacity: 0 });
    await measureWords('word', 280);

    const word = screen.getByTestId('word');
    expect(word).toHaveStyle({ fontSize: 22 });
    expect(word).not.toHaveStyle({ opacity: 0 });
  });

  it('takes the steps of the scale at the in-app text size', async () => {
    // At the larger ladder step every step is 51 / 44 of its size at M, as the Lemma grows.
    await render(
      <FontSizeProvider size={'larger'}>
        <WholeWordsText
          testID="word"
          text="Synchrophasotron"
          typeRole="heroWord"
          size={{ fontSize: 51, lineHeight: 66.3 }}
          lines={2}
          stepped
          style={typeStyle('heroWord', coreTokens)}
        />
      </FontSizeProvider>,
    );
    await layOut('word', 340);
    await measureWords('word', 371.2);
    await measureWords('word', 326.6);

    expect(screen.getByTestId('word')).toHaveStyle({ fontSize: (40 * 51) / 44 });
  });

  it('steps a phrase down until it fits its lines, wrapping only between words', async () => {
    await render(
      <WholeWordsText
        testID="phrase"
        text="Beat the bushes all day"
        typeRole="idiomExpression"
        lines={3}
        stepped
        style={typeStyle('idiomExpression', coreTokens)}
      />,
    );
    const start = typeRoles.idiomExpression.size;
    // The title scale runs from the largest down, so the next lower step is the first below.
    const lower = titleScale.find((step) => step < start);
    if (lower === undefined) throw new Error('No lower step on the title scale');
    await layOut('phrase', 300);
    await measureWords('phrase', 200);
    // At its start the phrase takes four lines, a step lower three.
    await measureLines('phrase', 4);
    expect(screen.getByTestId('phrase')).toHaveStyle({ opacity: 0 });
    await measureWords('phrase', 180);
    await measureLines('phrase', 3);

    const phrase = screen.getByTestId('phrase');
    expect(phrase).toHaveStyle({ fontSize: lower });
    expect(phrase).not.toHaveStyle({ opacity: 0 });
    expect(phrase.props).toMatchObject({ numberOfLines: 3 });
  });

  it('shrinks to 0.7 of the smallest step when even that is too wide', async () => {
    await render(
      <WholeWordsText
        testID="word"
        text="Thelongestwordintheworld"
        typeRole="heroWord"
        lines={2}
        stepped
        style={typeStyle('heroWord', coreTokens)}
      />,
    );
    await layOut('word', 100);
    for (let step = 0; step < 10; step += 1) await measureWords('word', 400);

    const word = screen.getByTestId('word');
    expect(word).toHaveStyle({ fontSize: 20 });
    expect(word).not.toHaveStyle({ opacity: 0 });
    expect(word.props).toMatchObject({
      numberOfLines: 1,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.7,
    });
  });

  it('ends a text cut at its lines with an ellipsis only when asked', async () => {
    await render(
      <>
        <WholeWordsText
          testID="asked"
          text="Take part"
          typeRole="heroWord"
          lines={2}
          stepped
          ellipsis
          style={typeStyle('heroWord', coreTokens)}
        />
        <WholeWordsText
          testID="plain"
          text="Take part"
          typeRole="heroWord"
          lines={2}
          stepped
          style={typeStyle('heroWord', coreTokens)}
        />
      </>,
    );

    expect(screen.getByTestId('asked')).toHaveProp('ellipsizeMode', 'tail');
    expect(screen.getByTestId('plain')).not.toHaveProp('ellipsizeMode');
  });
});
