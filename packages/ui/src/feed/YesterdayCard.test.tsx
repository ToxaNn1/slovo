import type { EditionStrings } from '@slovo/contracts';
import type { Haptics, WordCardModel } from '@slovo/core';
import {
  EditionProvider,
  HapticsProvider,
  KnowledgeButtons,
  VerticalPager,
  YesterdayCard,
} from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

const strings = {
  feedNotices: { yesterday: { title: 'Remember yesterday’s word?' } },
  wordCard: {
    partsOfSpeech: { noun: { short: 'n.', full: 'noun' } },
    genders: {},
    partOfSpeechWithGender: '{partOfSpeech}, {gender}',
    registers: {},
    category: '{category}',
    reveal: 'Show the meaning',
    extraDefinitions: 'Other meanings',
    example: '{text}',
  },
  knowledge: { known: 'Known', unknown: 'Unknown', correctionKnownHint: 'I say it right' },
} as unknown as EditionStrings;

const word: WordCardModel = {
  kind: 'word',
  wordId: 'w1',
  lemma: 'meek',
  stressedVowels: [],
  partOfSpeech: 'noun',
  gender: undefined,
  primaryDefinition: 'Quiet and gentle.',
  example: undefined,
  synonyms: [],
  antonyms: [],
  registers: [],
  region: undefined,
  history: undefined,
  categoryId: 'k1',
  categoryName: undefined,
  details: undefined,
  linkedCorrections: [],
  synonymRow: undefined,
};

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

/** The Feed's pages: the Yesterday card, then the next Entry's card behind it. */
const PAGES = ['yesterday', 'next'] as const;

async function renderFeed({ withMarks }: { withMarks: boolean }) {
  const onMark = jest.fn();
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <HapticsProvider haptics={haptics}>
        <VerticalPager
          testID="pager"
          items={PAGES}
          onIndexChange={jest.fn()}
          renderPage={(page) =>
            page === 'yesterday' ? (
              <YesterdayCard
                word={word}
                marks={
                  withMarks ? (
                    <KnowledgeButtons entryKind="word" mark={undefined} onTap={onMark} />
                  ) : undefined
                }
              />
            ) : (
              <Text>Next</Text>
            )
          }
        />
      </HapticsProvider>
    </EditionProvider>,
  );
  // The pages are drawn once the pager knows its height.
  await fireEvent(screen.getByTestId('pager'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  });
  return { onMark };
}

describe('the Yesterday card', () => {
  it('asks about yesterday’s Word and shows only its Lemma until the reader reveals it', async () => {
    const { onMark } = await renderFeed({ withMarks: true });

    expect(screen.getByTestId('feed-notice-yesterday')).toBeTruthy();
    expect(screen.getByText('Remember yesterday’s word?')).toBeTruthy();
    expect(screen.getByText('meek')).toBeTruthy();
    expect(screen.queryByText('Quiet and gentle.')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Known', disabled: true }));
    expect(onMark).not.toHaveBeenCalled();
  });

  it('shows the meaning on the reveal, and then takes a Knowledge Mark', async () => {
    const { onMark } = await renderFeed({ withMarks: true });

    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));

    expect(screen.getByText('Quiet and gentle.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Unknown', disabled: false }));
    expect(onMark).toHaveBeenCalledWith('unknown');
  });

  it('shows no Knowledge Mark buttons when it is given none', async () => {
    await renderFeed({ withMarks: false });

    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));

    expect(screen.getByText('Quiet and gentle.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Known' })).toBeNull();
  });
});
