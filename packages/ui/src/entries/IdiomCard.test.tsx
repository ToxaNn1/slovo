import type { IdiomCardModel } from '@slovo/core';
import { EditionProvider, EntryCard } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  wordCard: { example: '«{text}»', exampleAuthor: '— {author}', tabMore: 'More', tabLess: 'Less' },
  idiomCard: {
    idiomTypes: { idiom: 'idiom', placeName: 'place name', proverb: 'proverb' },
    heading: '{expression}, {type}',
    etymology: 'Origin',
    source: 'Source: {source}',
    tabs: { essence: 'Essence', origin: 'Origin', example: 'Example' },
  },
});

const model: IdiomCardModel = {
  kind: 'idiom',
  idiomId: 'i1',
  expression: 'to beat the bushes',
  idiomType: 'idiom',
  primaryDefinition: 'To idle about.',
  extraDefinitions: [],
  examples: [{ text: 'He beat the bushes all day.' }],
  etymology: 'From the hunt.',
  sourceNames: [],
};

async function renderTabbed() {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <EntryCard card={{ kind: 'idiom', entryId: 'i1', model }} tabs />
    </EditionProvider>,
  );
}

describe('the tabbed Idiom card (board XEntry2 e7)', () => {
  it('names its Idiom Type in the red kicker over the expression, not in a chip under it', async () => {
    await renderTabbed();

    const kicker = screen.getByTestId('idiom-type');
    expect(kicker).toHaveTextContent('idiom');
    expect(within(kicker).getByTestId('idiom-type-wedge')).toBeTruthy();
    expect(within(screen.getByRole('header')).queryByTestId('idiom-type')).toBeNull();
  });

  it('draws the red bar under the expression instead of underlining it', async () => {
    await renderTabbed();

    expect(screen.getByTestId('idiom-rule')).toBeTruthy();
    expect(screen.getByTestId('idiom-expression')).not.toHaveStyle({
      textDecorationLine: 'underline',
    });
  });

  it('sets the expression at 40 with a line of 1.02 and tracking -1', async () => {
    await renderTabbed();

    expect(screen.getByTestId('idiom-expression')).toHaveStyle({
      fontSize: 40,
      lineHeight: 40.8,
      letterSpacing: -1,
    });
  });

  it('reads the essence at 22/31 and the origin at Onest 500 18/27', async () => {
    await renderTabbed();

    expect(screen.getByTestId('idiom-definition')).toHaveStyle({ fontSize: 22, lineHeight: 31 });
    await fireEvent.press(screen.getByTestId('idiom-tab-origin'));
    expect(screen.getByTestId('idiom-etymology')).toHaveStyle({
      fontSize: 18,
      lineHeight: 27,
      fontWeight: '500',
    });
  });

  it('opens the Example tab with the big red quote mark and the Example without quotes', async () => {
    await renderTabbed();

    await fireEvent.press(screen.getByTestId('idiom-tab-example'));

    expect(
      screen.getByTestId('idiom-example-mark', { includeHiddenElements: true }),
    ).toHaveTextContent('«');
    expect(screen.getByTestId('idiom-example')).toHaveTextContent('He beat the bushes all day.');
    expect(screen.getByTestId('idiom-example')).not.toHaveTextContent(/«/);
  });

  it('starts every text it shows with a capital, whatever case the content has (owner decision 11)', async () => {
    await render(
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <EntryCard
          card={{
            kind: 'idiom',
            entryId: 'i1',
            model: {
              ...model,
              primaryDefinition: 'to idle about.',
              extraDefinitions: ['to search at random.'],
              examples: [{ text: 'he beat the bushes all day.' }],
              etymology: 'from the hunt.',
            },
          }}
          tabs
        />
      </EditionProvider>,
    );

    expect(screen.getByTestId('idiom-expression')).toHaveTextContent(/^To beat the bushes$/);
    expect(screen.getByText('To idle about.', { exact: true })).toBeTruthy();
    expect(screen.getByText('2. To search at random.', { exact: true })).toBeTruthy();
    await fireEvent.press(screen.getByTestId('idiom-tab-origin'));
    expect(screen.getByTestId('idiom-etymology')).toHaveTextContent('From the hunt.');
    await fireEvent.press(screen.getByTestId('idiom-tab-example'));
    expect(screen.getByTestId('idiom-example')).toHaveTextContent(/He beat the bushes all day\./);
  });
});
