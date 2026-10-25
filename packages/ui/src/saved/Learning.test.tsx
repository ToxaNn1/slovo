import type { EditionStrings } from '@slovo/contracts';
import type { EntryRowModel, LearningEntry } from '@slovo/core';
import { EditionProvider, LearningCard, LearningRow } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

/** The kinds of Entry and how a row names one beside its time. */
const history = {
  kinds: {
    word: 'word',
    correction: 'correction',
    wordOfTheDay: 'word of the day',
    idiom: 'idiom',
    placeName: 'place name',
    proverb: 'proverb',
  },
  kindBeside: '{kind} · {time}',
};

const strings = {
  history,
  learning: {
    title: 'Learning',
    count: { one: '{count} entry', other: '{count} entries' },
    cardLabel: 'Learning, {count}',
    reviewDay: {
      today: 'today',
      tomorrow: 'tomorrow',
      inDays: { one: 'in {count} day', other: 'in {count} days' },
    },
  },
} as EditionStrings;

const word = (entryId: string, title: string): EntryRowModel => ({
  kind: 'word',
  entryId,
  title,
  secondLine: `what ${title} means`,
  labelKey: 'word',
  spoken: `${title}, what ${title} means`,
  partOfSpeech: 'noun',
  registers: [],
});

const idiom: EntryRowModel = {
  kind: 'idiom',
  entryId: 'i1',
  title: 'spill the beans',
  secondLine: 'To give away a secret.',
  labelKey: 'idiom',
  spoken: 'spill the beans, To give away a secret.',
};

const correction: EntryRowModel = {
  kind: 'correction',
  entryId: 'c1',
  title: 'right',
  secondLine: 'wrong',
  labelKey: 'correction',
  spoken: 'right, wrong',
  correctionType: 'calque',
};

/** The Entry of the «Вчу» list with its row, `days` local days from its next Review. */
const learning = (row: EntryRowModel, days: number): LearningEntry => ({
  entryId: row.entryId,
  row,
  daysUntilReview: days,
});

/** The same strings in a language with four plural forms, as Ukrainian has. */
const ukStrings = {
  history,
  learning: {
    ...strings.learning,
    reviewDay: {
      ...strings.learning.reviewDay,
      inDays: {
        one: 'in {count} day (one)',
        few: 'in {count} days (few)',
        many: 'in {count} days (many)',
        other: 'in {count} days (other)',
      },
    },
  },
} as EditionStrings;

async function renderInEdition(element: ReactElement, { locale = 'en', learning = strings } = {}) {
  await render(
    <GestureHandlerRootView>
      <EditionProvider
        edition={{ locale }}
        strings={
          { ...learning, correctionCard: { insteadOf: 'instead of {form}' } } as EditionStrings
        }
      >
        {element}
      </EditionProvider>
    </GestureHandlerRootView>,
  );
}

describe('LearningRow', () => {
  it.each([
    [-2, 'today'],
    [0, 'today'],
    [1, 'tomorrow'],
    [3, 'in 3 days'],
    [7, 'in 7 days'],
  ])(
    'shows the Entry, its kind and its next Review day %i days away as «%s»',
    async (days, label) => {
      await renderInEdition(
        <LearningRow entry={learning(word('w1', 'river'), days)} onPress={jest.fn()} />,
      );

      expect(screen.getByText('river')).toBeTruthy();
      expect(screen.getByText('what river means')).toBeTruthy();
      expect(screen.getByText(`word · ${label}`)).toBeTruthy();
      expect(
        screen.getByRole('button', { name: `river, what river means, word · ${label}` }),
      ).toBeTruthy();
    },
  );

  it('names an Idiom’s kind beside its next Review day', async () => {
    await renderInEdition(<LearningRow entry={learning(idiom, 1)} onPress={jest.fn()} />);

    expect(screen.getByText('spill the beans')).toBeTruthy();
    expect(screen.getByText('idiom · tomorrow')).toBeTruthy();
  });

  it.each([
    [2, 'in 2 days (few)'],
    [5, 'in 5 days (many)'],
    [21, 'in 21 day (one)'],
  ])('takes the plural form of the Edition’s language, %i days away', async (days, label) => {
    await renderInEdition(
      <LearningRow entry={learning(word('w1', 'river'), days)} onPress={jest.fn()} />,
      { locale: 'uk', learning: ukStrings },
    );

    expect(screen.getByText(`word · ${label}`)).toBeTruthy();
  });

  it('shows a Correction with the form it replaces', async () => {
    await renderInEdition(<LearningRow entry={learning(correction, 1)} onPress={jest.fn()} />);

    expect(
      screen.getByRole('button', { name: 'right, instead of wrong, correction · tomorrow' }),
    ).toBeTruthy();
  });

  it('opens the Entry on a tap', async () => {
    const onPress = jest.fn();
    await renderInEdition(
      <LearningRow entry={learning(word('w1', 'river'), 1)} onPress={onPress} />,
    );

    await fireEvent.press(screen.getByTestId('learning-row-w1-open'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('offers no action to rename, delete or take the Entry out', async () => {
    await renderInEdition(
      <LearningRow entry={learning(word('w1', 'river'), 1)} onPress={jest.fn()} />,
    );

    // Nothing behind a swipe either: the row's one button is the row itself.
    expect(screen.queryAllByRole('button', { includeHiddenElements: true })).toEqual([
      screen.getByTestId('learning-row-w1-open'),
    ]);
  });
});

describe('LearningCard', () => {
  const entries = [
    learning(word('w1', 'river'), 0),
    learning(word('w2', 'stone'), 1),
    learning(correction, 3),
    learning(word('w3', 'cloud'), 7),
  ];

  it('shows the count and the next three Entries with their Review days', async () => {
    await renderInEdition(<LearningCard entries={entries} onPress={jest.fn()} />);

    expect(screen.getByText('Learning')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    for (const text of ['river', 'today', 'stone', 'tomorrow', 'right', 'in 3 days']) {
      expect(screen.getByText(text, { includeHiddenElements: true })).toBeTruthy();
    }
    expect(screen.queryByText('cloud', { includeHiddenElements: true })).toBeNull();
  });

  it('opens the list on a tap', async () => {
    const onPress = jest.fn();
    await renderInEdition(<LearningCard entries={entries} onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Learning, 4 entries' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
