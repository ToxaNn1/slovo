import type { PreviousWordsBlock } from '@slovo/core';
import { EditionProvider, PreviousWords } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const strings = testStrings({ dashboard: { previousWords: { title: 'Previous', months } } });

async function show(title: string) {
  const block: PreviousWordsBlock = {
    kind: 'previousWords',
    days: [
      {
        date: { year: 2026, month: 11, day: 11 },
        dateLabel: '11 November',
        row: {
          kind: 'word',
          entryId: 'w_one',
          title,
          secondLine: 'Great strength',
          spoken: title,
          labelKey: 'word',
          partOfSpeech: 'noun',
          gender: undefined,
          registers: [],
          rarity: 3,
        },
      },
    ],
  };
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <PreviousWords block={block} onOpen={jest.fn()} />
    </EditionProvider>,
  );
}

describe('PreviousWords', () => {
  it('starts the Lemma with a capital, on screen and to VoiceOver', async () => {
    await show('might');

    expect(screen.getByText('Might')).toBeTruthy();
    expect(screen.queryByText('might')).toBeNull();
    expect(screen.getByRole('button').props['accessibilityLabel']).toContain('Might');
  });

  it('keeps the stress mark of a Lemma it capitalises', async () => {
    await show('o\u0301bri');

    expect(screen.getByText('O\u0301bri')).toBeTruthy();
  });
});
