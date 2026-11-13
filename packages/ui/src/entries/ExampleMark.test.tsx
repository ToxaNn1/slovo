import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { EditionProvider, ExampleMark } from '@slovo/ui';
import { testStrings } from '../test-strings';
import { typeRoles } from '../tokens';

const hidden = { includeHiddenElements: true };

async function renderMark(example: string) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({ wordCard: { example } })}>
      <ExampleMark testID="mark" />
    </EditionProvider>,
  );
}

describe("the big red quote mark over a card's first Example (boards p1 and XEntry2 e7)", () => {
  it("draws the Edition's opening quote whole, its line never tighter than the font, in the board's 26 box", async () => {
    await renderMark('«{text}»');

    const mark = screen.getByTestId('mark', hidden);
    expect(mark).toHaveTextContent('«');
    const style = (StyleSheet.flatten(mark.props['style']) ?? {}) as { lineHeight?: number };
    expect(mark).toHaveStyle({
      fontSize: typeRoles.exampleMark.size,
      fontWeight: typeRoles.exampleMark.weight,
    });
    // iOS cuts a line set tighter than the font, and the tab clips what rises
    // over it: a 26 line left two skewed bars of the «.
    expect(style.lineHeight ?? Infinity).toBeGreaterThanOrEqual(typeRoles.exampleMark.size);
    expect(StyleSheet.flatten(screen.getByTestId('mark-box', hidden).props['style'])).toMatchObject(
      {
        height: typeRoles.exampleMark.lineHeight,
      },
    );
  });

  it('draws nothing when the Edition quotes an Example without an opening mark', async () => {
    await renderMark('{text}');

    expect(screen.queryByTestId('mark', hidden)).toBeNull();
    expect(screen.queryByTestId('mark-box', hidden)).toBeNull();
  });
});
