import type { ShareCardContent } from '@slovo/core';
import { coreTokens, EditionProvider, TokensProvider, type ColorScheme } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen, within } from '@testing-library/react-native';

import { ShareCard, type ShareCardProps } from './ShareCard';
import { testStrings } from '../test-strings';

const strings = testStrings({
  share: { nonStandard: 'Often said', standard: 'Better' },
  idiomCard: { etymology: 'Origin' },
});

async function renderCard(
  content: ShareCardContent,
  format: 'story' | 'square',
  colorScheme: ColorScheme = 'light',
  badge?: ShareCardProps['badge'],
) {
  await render(
    <TokensProvider tokens={coreTokens} colorScheme={colorScheme}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <ShareCard content={content} watermark="SLOVO" badge={badge} format={format} width={300} />
      </EditionProvider>
    </TokensProvider>,
  );
  return screen.getByTestId('share-card');
}

const word: ShareCardContent = {
  shows: 'w1',
  overline: 'Word of the Day',
  label: 'Word of the Day. bustle, stress on u. noun. A fuss.',
  body: { kind: 'word', lemma: 'bústle', grammar: 'n. · coll.', definition: 'A fuss.' },
};

const correction: ShareCardContent = {
  shows: 'c1',
  overline: 'calque',
  label: 'calque. Often said: take part. Better: join in',
  body: { kind: 'correction', nonStandardForm: 'take part', standardForm: 'join in' },
};

describe('ShareCard', () => {
  it("draws a Word's overline, Lemma, grammar line, Definition and watermark as given, and reads its label", async () => {
    const card = await renderCard(word, 'story');

    for (const text of ['Word of the Day', 'bústle', 'n. · coll.', 'A fuss.', 'SLOVO']) {
      expect(within(card).getByText(text)).toBeOnTheScreen();
    }
    expect(card).toHaveAccessibleName('Word of the Day. bustle, stress on u. noun. A fuss.');
  });

  it("draws a Correction's forms under the Edition's labels, with the overline in the Square's footer", async () => {
    const card = await renderCard(correction, 'square');

    for (const text of ['Often said', 'take part', 'Better', 'join in', 'calque', 'SLOVO']) {
      expect(within(card).getByText(text)).toBeOnTheScreen();
    }
    expect(card).toHaveAccessibleName('calque. Often said: take part. Better: join in');
  });

  it("draws a Level's title, number and name", async () => {
    const card = await renderCard(
      {
        shows: 'level:5',
        overline: '1 November',
        label: '1 November. New level. Level 5. Expert',
        body: { kind: 'milestone', title: 'New level', headline: 'Level 5', detail: 'Expert' },
      },
      'story',
    );

    for (const text of ['1 November', 'New level', 'Level 5', 'Expert']) {
      expect(within(card).getByText(text)).toBeOnTheScreen();
    }
  });

  it("draws a solved Daily Crossword's open cells with no letter", async () => {
    const card = await renderCard(
      {
        shows: 'crossword:2026-11-01',
        overline: '1 November',
        label: '1 November. Crossword solved. An empty grid',
        body: {
          kind: 'dailyCrossword',
          title: 'Crossword solved',
          grid: [
            [true, true],
            [false, true],
          ],
        },
      },
      'square',
    );

    expect(within(card).getByText('Crossword solved')).toBeOnTheScreen();
    expect(within(card).getAllByTestId('crossword-open-cell')).toHaveLength(3);
    expect(within(card).getAllByTestId('crossword-closed-cell')).toHaveLength(1);
  });

  it('is red in the light Theme and the dark ground in the dark one, the giant glyph in cream or red', async () => {
    const { light, dark } = coreTokens.colors;

    const lightCard = await renderCard(word, 'story', 'light');
    expect(lightCard).toHaveStyle({ backgroundColor: light.accent });
    expect(within(lightCard).getByTestId('share-card-giant')).toHaveStyle({
      color: light.onAccent,
    });

    const darkCard = await renderCard(word, 'square', 'dark');
    expect(darkCard).toHaveStyle({ backgroundColor: dark.background });
    expect(within(darkCard).getByTestId('share-card-giant')).toHaveStyle({ color: dark.accent });
  });

  it("puts an Entry's first letter, without its Stress, behind it, and the Mascot shouting", async () => {
    const card = await renderCard(
      {
        shows: 'w2',
        overline: 'Word of the Day',
        label: 'Word of the Day. echo',
        body: { kind: 'word', lemma: 'écho', grammar: 'n.', definition: 'A sound.' },
      },
      'story',
    );

    expect(within(card).getByTestId('share-card-giant')).toHaveTextContent('E');
    expect(within(card).getByTestId('mascot-shouts')).toBeOnTheScreen();
  });

  it("puts a milestone's number behind it, and the Mascot celebrating", async () => {
    const card = await renderCard(
      {
        shows: 'streak:23',
        overline: '2 November',
        label: '23 days in a row',
        body: {
          kind: 'milestone',
          title: 'My streak',
          headline: '23 days in a row',
          detail: undefined,
        },
      },
      'square',
    );

    expect(within(card).getByTestId('share-card-giant')).toHaveTextContent('23');
    expect(within(card).getByTestId('mascot-celebrates')).toBeOnTheScreen();
  });

  const badgeCard: ShareCardContent = {
    shows: 'badge:week',
    overline: '2 November',
    label: 'Badge earned. A week',
    body: { kind: 'milestone', title: 'Badge earned', headline: 'A week', detail: undefined },
  };

  it("carries a Badge's poster mark over its title", async () => {
    const card = await renderCard(badgeCard, 'square', 'light', {
      shape: 'hexagon',
      tone: 'ink',
      symbol: '7',
    });

    expect(within(card).getByTestId('share-card-badge-symbol')).toHaveTextContent('7');
  });

  it('carries no mark on a milestone that is not a Badge', async () => {
    const card = await renderCard(badgeCard, 'square');

    expect(within(card).queryByTestId('share-card-badge')).toBeNull();
  });

  it("draws a Weekly Recap's numbers with no giant glyph, and the Mascot happy", async () => {
    const card = await renderCard(
      {
        shows: 'week:2026-10-26',
        overline: '26.10–1.11',
        label: 'My week. 48 seen',
        body: { kind: 'weeklyRecap', title: 'My week', numbers: [{ label: 'seen', count: 48 }] },
      },
      'story',
    );

    for (const text of ['26.10–1.11', 'My week', '48', 'seen']) {
      expect(within(card).getByText(text)).toBeOnTheScreen();
    }
    expect(within(card).queryByTestId('share-card-giant')).toBeNull();
    expect(within(card).getByTestId('mascot-happy')).toBeOnTheScreen();
  });
});
