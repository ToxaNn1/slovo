import { EditionProvider, FontSizePreview, FontSizeProvider } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { testStrings } from '../test-strings';
import { fontSizeSteps } from '../tokens';

const strings = testStrings({});

describe('FontSizePreview', () => {
  // #1508: «шпаркий» broke inside the word at the largest step.
  it('draws its Lemma at a lower step of the title scale instead of breaking it inside the word when it is wider than the card', async () => {
    await render(
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <FontSizePreview lemma="sprightly" definition="Quick and lively." />
      </EditionProvider>,
      {
        wrapper: ({ children }) => (
          <FontSizeProvider size={{ scale: 'fontSize', step: 'XL' }}>{children}</FontSizeProvider>
        ),
      },
    );
    const lemma = screen.getByTestId('font-size-preview-lemma');
    const line = lemma.parent;
    if (line === null) throw new Error('The Lemma has no line around it');
    await fireEvent(line, 'layout', { nativeEvent: { layout: { width: 201 } } });
    // At XL every step is 65 / 50 of its size at M; the word is 400 wide at 65.
    const factor = fontSizeSteps.XL.lemma / 50;
    for (const step of [50, 44, 40, 36, 32, 28, 26, 24]) {
      const measured = screen
        .getAllByText('sprightly', { includeHiddenElements: true })
        .find((text) => text !== screen.getByTestId('font-size-preview-lemma'));
      if (measured === undefined) throw new Error('The Lemma is not measured');
      const width = (400 * step * factor) / fontSizeSteps.XL.lemma;
      await fireEvent(measured, 'textLayout', { nativeEvent: { lines: [{ width }] } });
    }

    expect(lemma).toHaveTextContent('sprightly');
    expect(screen.getByTestId('font-size-preview-lemma')).toHaveStyle({ fontSize: 24 * factor });
    expect(screen.getByTestId('font-size-preview-lemma')).not.toHaveStyle({ opacity: 0 });
  });
});
