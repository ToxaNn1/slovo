import type { IdiomCardModel } from '@slovo/core';
import { EditionProvider } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { FontSizeProvider, type TextSizeStep } from '../providers/FontSizeProvider';
import { testStrings } from '../test-strings';
import { EntryPanelHeadline } from './EntryPanelHeadline';

const strings = testStrings({
  idiomCard: {
    idiomTypes: { idiom: 'idiom', placeName: 'place name', proverb: 'proverb' },
    heading: '{expression}, {type}',
    etymology: 'Origin',
    source: 'Source: {source}',
    tabs: { essence: 'Essence', origin: 'Origin', example: 'Example' },
  },
});

const model = (expression: string): IdiomCardModel => ({
  kind: 'idiom',
  idiomId: 'i1',
  expression,
  idiomType: 'idiom',
  primaryDefinition: 'To idle about.',
  extraDefinitions: [],
  examples: [],
  etymology: undefined,
  sourceNames: [],
});

async function renderHeadline(expression: string, size: TextSizeStep) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <FontSizeProvider size={size}>
        <EntryPanelHeadline card={{ kind: 'idiom', entryId: 'i1', model: model(expression) }} />
      </FontSizeProvider>
    </EditionProvider>,
  );
}

describe("Entry details' panel headline", () => {
  it.each(['Beat', 'to beat the bushes all day long in the rain'])(
    'starts «%s» at 24, whatever its length, on two lines that end in an ellipsis',
    async (expression) => {
      await renderHeadline(expression, 'system');

      const title = screen.getByTestId('entry-panel-title');
      expect(title).toHaveStyle({ fontSize: 24 });
      expect(title.props).toMatchObject({
        numberOfLines: expression.includes(' ') ? 2 : 1,
        adjustsFontSizeToFit: true,
        minimumFontScale: 0.7,
        ellipsizeMode: 'tail',
        maxFontSizeMultiplier: 1.5,
      });
    },
  );

  it('grows by the in-app text size, never to the main card’s size', async () => {
    await renderHeadline('to beat the bushes', 'larger');

    expect(screen.getByTestId('entry-panel-title')).toHaveStyle({ fontSize: 24 * (51 / 44) });
  });
});
