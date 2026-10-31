import type { ShareCardContent } from '@slovo/core';
import { EditionProvider } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen, within } from '@testing-library/react-native';

import { ShareCard } from './ShareCard';
import { testStrings } from '../test-strings';

const strings = testStrings({
  share: { nonStandard: 'Often said', standard: 'Better' },
  idiomCard: { etymology: 'Origin' },
});

async function renderCard(content: ShareCardContent, format: 'story' | 'square') {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <ShareCard content={content} watermark="SLOVO" format={format} width={300} />
    </EditionProvider>,
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
});
