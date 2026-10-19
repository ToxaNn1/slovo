import type { EditionStrings } from '@slovo/contracts';
import type { EntryRowModel } from '@slovo/core';
import { EditionProvider, LearningCard, LearningRow, type LearningItem } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const strings = {
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
  definition: `what ${title} means`,
  partOfSpeech: 'noun',
  registers: [],
});

const correction: EntryRowModel = {
  kind: 'correction',
  entryId: 'c1',
  title: 'right',
  nonStandardForm: 'wrong',
  correctionType: 'calque',
};

async function renderInEdition(element: ReactElement) {
  await render(
    <GestureHandlerRootView>
      <EditionProvider
        edition={{ locale: 'en' }}
        strings={{ ...strings, correctionCard: { insteadOf: 'instead of {form}' } } as EditionStrings}
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
  ])('shows the Entry and its next Review day %i days away as «%s»', async (days, label) => {
    await renderInEdition(
      <LearningRow item={{ row: word('w1', 'river'), daysUntilReview: days }} onPress={jest.fn()} />,
    );

    expect(screen.getByText('river')).toBeTruthy();
    expect(screen.getByText('what river means')).toBeTruthy();
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByRole('button', { name: `river, what river means, ${label}` })).toBeTruthy();
  });

  it('shows a Correction with the form it replaces', async () => {
    await renderInEdition(
      <LearningRow item={{ row: correction, daysUntilReview: 1 }} onPress={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'right, instead of wrong, tomorrow' })).toBeTruthy();
  });

  it('opens the Entry on a tap', async () => {
    const onPress = jest.fn();
    await renderInEdition(
      <LearningRow item={{ row: word('w1', 'river'), daysUntilReview: 1 }} onPress={onPress} />,
    );

    await fireEvent.press(screen.getByTestId('learning-row-w1-open'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('offers no action to rename, delete or take the Entry out', async () => {
    await renderInEdition(
      <LearningRow item={{ row: word('w1', 'river'), daysUntilReview: 1 }} onPress={jest.fn()} />,
    );

    expect(screen.getByTestId('learning-row-w1-open')).toHaveProp('accessibilityActions', []);
    expect(screen.queryAllByRole('button')).toHaveLength(1);
  });
});

describe('LearningCard', () => {
  const items: readonly LearningItem[] = [
    { row: word('w1', 'river'), daysUntilReview: 0 },
    { row: word('w2', 'stone'), daysUntilReview: 1 },
    { row: correction, daysUntilReview: 3 },
    { row: word('w3', 'cloud'), daysUntilReview: 7 },
  ];

  it('shows the count and the next three Entries with their Review days', async () => {
    await renderInEdition(<LearningCard shown items={items} onPress={jest.fn()} />);

    expect(screen.getByText('Learning')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    for (const text of ['river', 'today', 'stone', 'tomorrow', 'right', 'in 3 days']) {
      expect(screen.getByText(text, { includeHiddenElements: true })).toBeTruthy();
    }
    expect(screen.queryByText('cloud', { includeHiddenElements: true })).toBeNull();
  });

  it('opens the list on a tap', async () => {
    const onPress = jest.fn();
    await renderInEdition(<LearningCard shown items={items} onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Learning, 4 entries' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is not drawn while the knowledge switch is off', async () => {
    await renderInEdition(<LearningCard shown={false} items={items} onPress={jest.fn()} />);

    expect(screen.queryByTestId('saved-learning')).toBeNull();
    expect(screen.queryByText('Learning')).toBeNull();
  });
});
