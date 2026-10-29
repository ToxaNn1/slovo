import type { EditionStrings } from '@slovo/contracts';
import type { SynonymRowCardModel, SynonymRowFeedCard } from '@slovo/core';
import { ActionRow, EditionProvider, EntryCard, KnowledgeButtons } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

const strings = {
  wordCard: {
    reveal: 'Show the meaning',
    example: '{text}',
    exampleAuthor: '— {author}',
    stress: 'stress on {vowels}',
    stressOr: 'or',
  },
  synonymRowCard: {
    chip: 'synonyms',
    heading: '{dominant}, synonym row: {members}',
    concealedHeading: '{dominant}, synonym row',
    source: 'Source: {source}',
  },
  knowledge: { known: 'Known', unknown: 'Unknown' },
} as unknown as EditionStrings;

const model: SynonymRowCardModel = {
  kind: 'synonymRow',
  synonymRowId: 'r1',
  dominant: { text: 'wálk', stressedVowels: ['a'], wordId: undefined },
  meaning: 'To move on foot.',
  members: [
    { text: 'stróll', stressedVowels: ['o'], wordId: 'w-stroll', shadeNote: 'slowly' },
    { text: 'limp', stressedVowels: [], wordId: undefined, shadeNote: 'lamely' },
    { text: 'trámp', stressedVowels: ['a'], wordId: 'w-tramp', shadeNote: undefined },
  ],
  example: { text: 'They walked to the river.' },
  sourceNames: ['A dictionary of synonyms', 'A style guide'],
};

const card: SynonymRowFeedCard = { kind: 'synonymRow', entryId: 'r1', model };

function inEdition(children: React.ReactNode) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      {children}
    </EditionProvider>
  );
}

describe('the Synonym Row card', () => {
  it('shows the dominant with its chip, the meaning, the members with their shades, the example and the sources', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.getByTestId('synonymRow-card')).toBeTruthy();
    expect(screen.getByTestId('synonym-row-dominant')).toHaveTextContent('wálk');
    expect(screen.getByTestId('synonym-row-chip')).toHaveTextContent('synonyms');
    expect(screen.getByTestId('synonym-row-meaning')).toHaveTextContent('To move on foot.');
    const members = screen.getAllByTestId(/^synonym-row-member-/);
    expect(members.map((member) => member.props['testID'] as string)).toEqual([
      'synonym-row-member-0',
      'synonym-row-member-1',
      'synonym-row-member-2',
    ]);
    expect(members[0]).toHaveTextContent('stróll slowly');
    expect(members[1]).toHaveTextContent('limp lamely');
    expect(members[2]).toHaveTextContent('trámp');
    expect(screen.getByTestId('synonym-row-example')).toHaveTextContent(
      'They walked to the river.',
    );
    expect(screen.getByTestId('synonym-row-source')).toHaveTextContent(
      'Source: A dictionary of synonyms; A style guide',
    );
  });

  it('leaves out the example and the source line when the row has none', async () => {
    await render(
      inEdition(
        <EntryCard card={{ ...card, model: { ...model, example: undefined, sourceNames: [] } }} />,
      ),
    );

    expect(screen.queryByTestId('synonym-row-example')).toBeNull();
    expect(screen.queryByTestId('synonym-row-source')).toBeNull();
  });

  it('opens the Word of a linked member on a tap', async () => {
    const onOpenWord = jest.fn();
    await render(inEdition(<EntryCard card={card} onOpenWord={onOpenWord} />));

    await fireEvent.press(screen.getByRole('button', { name: 'stroll, stress on o, slowly' }));
    await fireEvent.press(screen.getByRole('button', { name: 'tramp, stress on a' }));

    expect(onOpenWord.mock.calls).toEqual([['w-stroll'], ['w-tramp']]);
  });

  it('shows a member without a Word as plain text that does not react to a tap', async () => {
    const onOpenWord = jest.fn();
    await render(inEdition(<EntryCard card={card} onOpenWord={onOpenWord} />));

    const plain = screen.getByTestId('synonym-row-member-1');
    expect(plain).not.toHaveProp('accessibilityRole', 'button');
    expect(screen.queryByRole('button', { name: /^limp/ })).toBeNull();
    await fireEvent.press(within(plain).getByText(/^limp/));

    expect(onOpenWord).not.toHaveBeenCalled();
  });

  it('reads the dominant with the whole row to VoiceOver, without Stress marks', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(
      screen.getByRole('header', { name: 'walk, synonym row: stroll, limp, tramp' }),
    ).toBeTruthy();
    expect(screen.getByTestId('synonym-row-member-1')).toHaveProp(
      'accessibilityLabel',
      'limp, lamely',
    );
  });

  it('lets the members wrap and never shrinks or cuts their text at the largest font size on the SE', async () => {
    const window = Dimensions.get('window');
    Dimensions.set({ window: { width: 375, height: 667, scale: 2, fontScale: 3.12 } });

    try {
      await render(inEdition(<EntryCard card={card} />));

      expect(screen.getByTestId('synonym-row-members')).toHaveStyle({ flexWrap: 'wrap' });
      for (const text of [
        within(screen.getByTestId('synonym-row-member-0')).getByText(/^stro\u0301ll/),
        screen.getByTestId('synonym-row-meaning'),
      ]) {
        expect(text).not.toHaveProp('numberOfLines');
        expect(text).not.toHaveProp('adjustsFontSizeToFit');
      }
    } finally {
      Dimensions.set({ window });
    }
  });
});

describe('Self-check on a Synonym Row card', () => {
  it('shows only the dominant, its marks inactive, until the reader reveals it', async () => {
    const onMark = jest.fn();
    await render(
      inEdition(
        <EntryCard
          card={card}
          selfCheck
          actions={
            <ActionRow
              marks={<KnowledgeButtons entryKind="word" mark={undefined} onTap={onMark} />}
            />
          }
        />,
      ),
    );

    expect(screen.getByRole('header', { name: 'walk, synonym row' })).toBeTruthy();
    expect(screen.getByTestId('synonym-row-dominant')).toHaveTextContent('wálk');
    for (const concealed of [
      'synonym-row-meaning',
      'synonym-row-members',
      'synonym-row-example',
      'synonym-row-source',
    ]) {
      expect(screen.queryByTestId(concealed)).toBeNull();
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Known', disabled: true }));
    expect(onMark).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));

    expect(screen.getByTestId('synonym-row-meaning')).toHaveTextContent('To move on foot.');
    expect(screen.getAllByTestId(/^synonym-row-member-/)).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Show the meaning' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Known', disabled: false }));
    expect(onMark).toHaveBeenCalledWith('known');
  });
});

describe('VoiceOver on the texts of a Synonym Row card with a Stress mark', () => {
  it('shows the Stress marks and reads the meaning and the example without them', async () => {
    const stressed: SynonymRowFeedCard = {
      ...card,
      model: {
        ...model,
        meaning: 'To move on fóot.',
        example: { text: 'They wálked to the river.' },
      },
    };
    await render(inEdition(<EntryCard card={stressed} />));

    expect(screen.getByTestId('synonym-row-meaning')).toHaveTextContent('To move on fóot.');
    expect(screen.getByTestId('synonym-row-meaning')).toHaveProp(
      'accessibilityLabel',
      'To move on foot.',
    );
    expect(screen.getByTestId('synonym-row-example')).toHaveTextContent(
      'They wálked to the river.',
    );
    expect(screen.getByTestId('synonym-row-example')).toHaveProp(
      'accessibilityLabel',
      'They walked to the river.',
    );
  });
});
