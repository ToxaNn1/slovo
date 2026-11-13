import type { SynonymRowCardModel, SynonymRowFeedCard } from '@slovo/core';
import { ActionRow, EditionProvider, EntryCard, KnowledgeButtons } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  wordCard: {
    tabSource: 'Source',
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
    page: 'Row · {page}/{pages}',
  },
  knowledge: { known: 'Known', unknown: 'Unknown' },
});

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
  it('shows the dominant with its kicker, the meaning, the members with their shades, the example and the sources', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.getByTestId('synonymRow-card')).toBeTruthy();
    expect(screen.getByTestId('synonym-row-dominant')).toHaveTextContent('Wálk');
    expect(screen.getByTestId('synonym-row-kicker')).toHaveTextContent('synonyms');
    expect(screen.queryByTestId('synonym-row-chip')).toBeNull();
    expect(screen.getByTestId('synonym-row-meaning')).toHaveTextContent('To move on foot.');
    const members = screen.getAllByTestId(/^synonym-row-member-\d+$/);
    expect(members.map((member) => member.props['testID'] as string)).toEqual([
      'synonym-row-member-0',
      'synonym-row-member-1',
      'synonym-row-member-2',
    ]);
    expect(members[0]).toHaveTextContent(/Slowly$/);
    expect(members[1]).toHaveTextContent(/^Limp.*Lamely$/);
    expect(members[2]).toHaveTextContent('Trámp');
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
    await fireEvent.press(within(plain).getByText(/^Limp/));

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

  it('sets the members one per row, a hairline between, the shade note upright at the right', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.getByTestId('synonym-row-member-0')).toHaveStyle({ borderTopWidth: 0 });
    expect(screen.getByTestId('synonym-row-member-1')).toHaveStyle({
      borderTopWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
    });
    expect(screen.getByTestId('synonym-row-member-0-shade')).toHaveTextContent('Slowly');
    expect(screen.getByTestId('synonym-row-member-0-shade')).toHaveStyle({
      fontStyle: 'normal',
      fontSize: 14,
    });
  });

  it('draws the red bar under the dominant', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.getByTestId('synonym-row-rule')).toBeTruthy();
  });

  it('never shrinks or cuts their text at the largest font size on the SE', async () => {
    const window = Dimensions.get('window');
    Dimensions.set({ window: { width: 375, height: 667, scale: 2, fontScale: 3.12 } });

    try {
      await render(inEdition(<EntryCard card={card} />));

      for (const text of [
        within(screen.getByTestId('synonym-row-member-0')).getByText(/^Stro\u0301ll/),
        screen.getByTestId('synonym-row-meaning'),
      ]) {
        expect(text).not.toHaveProp('numberOfLines');
        expect(text).not.toHaveProp('adjustsFontSizeToFit');
      }
    } finally {
      Dimensions.set({ window });
    }
  });
  it('starts every text it shows with a capital, whatever case the content has (owner decision 11)', async () => {
    const lowercase: SynonymRowFeedCard = {
      ...card,
      model: { ...model, meaning: 'to move on foot.', example: { text: 'they walked.' } },
    };
    await render(inEdition(<EntryCard card={lowercase} />));

    expect(screen.getByTestId('synonym-row-dominant')).toHaveTextContent(/^W/);
    expect(screen.getByTestId('synonym-row-meaning')).toHaveTextContent('To move on foot.');
    const members = screen.getAllByTestId(/^synonym-row-member-\d+$/);
    expect(members[0]).toHaveTextContent(/^Str.*Slowly$/);
    expect(members[1]).toHaveTextContent(/^Limp.*Lamely$/);
    expect(members[2]).toHaveTextContent(/^Tr/);
    expect(screen.getByTestId('synonym-row-example')).toHaveTextContent(/They walked\./);
  });
});

describe('the tabbed Synonym Row card (board XEntry2 e8)', () => {
  const members = ['stroll', 'limp', 'tramp', 'pace', 'trudge', 'march'].map((text) => ({
    text,
    stressedVowels: [],
    wordId: undefined,
    shadeNote: undefined,
  }));

  async function renderTabbed(shown: SynonymRowCardModel) {
    await render(inEdition(<EntryCard card={{ ...card, model: shown }} tabs />));
  }

  it('pages the members four at a time, the meaning on the first page, the example and sources on the last', async () => {
    await renderTabbed({ ...model, members });

    expect(
      screen.getAllByRole('tab').map((tab) => tab.props['accessibilityLabel'] as string),
    ).toEqual(['Row · 1/2', 'Row · 2/2']);
    expect(screen.getByTestId('synonym-row-meaning')).toBeTruthy();
    expect(screen.getAllByTestId(/^synonym-row-member-\d+$/)).toHaveLength(4);
    expect(screen.queryByTestId('synonym-row-example')).toBeNull();

    await fireEvent.press(screen.getByTestId('synonymRow-tab-page-2'));

    expect(screen.queryByTestId('synonym-row-meaning')).toBeNull();
    expect(
      screen.getAllByTestId(/^synonym-row-member-\d+$/).map((m) => m.props['testID'] as string),
    ).toEqual(['synonym-row-member-4', 'synonym-row-member-5']);
    expect(screen.getByTestId('synonym-row-example')).toBeTruthy();
    expect(screen.getByTestId('synonym-row-source')).toBeTruthy();
  });

  it('with the Source tab, names the sources in a last tab after the pages, not on the last page', async () => {
    await render(
      inEdition(<EntryCard card={{ ...card, model: { ...model, members } }} tabs sourceTab />),
    );

    expect(
      screen.getAllByRole('tab').map((tab) => tab.props['accessibilityLabel'] as string),
    ).toEqual(['Row · 1/2', 'Row · 2/2', 'Source']);

    await fireEvent.press(screen.getByTestId('synonymRow-tab-page-2'));

    expect(screen.getByTestId('synonym-row-example')).toBeTruthy();
    expect(screen.queryByTestId('synonym-row-source')).toBeNull();

    await fireEvent.press(screen.getByTestId('synonymRow-tab-source'));

    expect(screen.getByTestId('synonymRow-source-0')).toHaveTextContent(
      'A dictionary of synonyms',
      {
        exact: true,
      },
    );
    expect(screen.getByTestId('synonymRow-source-1')).toHaveTextContent('A style guide', {
      exact: true,
    });
  });

  it('draws no tab bar for a row of four members or fewer', async () => {
    await renderTabbed(model);

    expect(screen.queryAllByRole('tab')).toEqual([]);
    expect(screen.getAllByTestId(/^synonym-row-member-\d+$/)).toHaveLength(3);
    expect(screen.getByTestId('synonym-row-example')).toBeTruthy();
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
          slots={{
            slot: 'actions',
            actions: (
              <ActionRow
                marks={<KnowledgeButtons entryKind="word" mark={undefined} onTap={onMark} />}
              />
            ),
          }}
        />,
      ),
    );

    expect(screen.getByRole('header', { name: 'walk, synonym row' })).toBeTruthy();
    expect(screen.getByTestId('synonym-row-dominant')).toHaveTextContent('Wálk');
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
    expect(screen.getAllByTestId(/^synonym-row-member-\d+$/)).toHaveLength(3);
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
