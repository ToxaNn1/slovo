import { EditionProvider, FontSizePreview, FontSizeProvider } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { testStrings } from '../test-strings';
import { fontSizeSteps } from '../tokens';

const strings = testStrings({});

describe('FontSizePreview', () => {
  // #1508: «шпаркий» broke inside the word at the largest step.
  it('draws its Lemma smaller instead of breaking it inside the word when it is wider than the card', async () => {
    await render(
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <FontSizePreview lemma="sprightly" definition="Quick and lively." />
      </EditionProvider>,
      { wrapper: ({ children }) => <FontSizeProvider fontSize="XL">{children}</FontSizeProvider> },
    );
    const lemma = screen.getByTestId('font-size-preview-lemma');
    const line = lemma.parent;
    if (line === null) throw new Error('The Lemma has no line around it');
    await fireEvent(line, 'layout', { nativeEvent: { layout: { width: 201 } } });
    // The word measured at full size: twice as wide as the card has room for, less a point.
    const measured = screen
      .getAllByText('sprightly', { includeHiddenElements: true })
      .find((text) => text !== lemma);
    if (measured === undefined) throw new Error('The Lemma is not measured');
    await fireEvent(measured, 'textLayout', { nativeEvent: { lines: [{ width: 400 }] } });

    expect(lemma).toHaveTextContent('sprightly');
    expect(lemma).toHaveStyle({ fontSize: fontSizeSteps.XL.lemma / 2 });
    expect(lemma).not.toHaveStyle({ opacity: 0 });
  });
});
