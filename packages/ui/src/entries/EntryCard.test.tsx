import { type WordFeedCard } from '@slovo/core/testing';
import { type CorrectionCardModel, type EntryFeedCard, type IdiomCardModel } from '@slovo/core';
import { EditionProvider, EntryCard, PronunciationButton } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useConcealed } from './self-check';
import { testStrings } from '../test-strings';
import { tightLineDrop, typeRoles } from '../tokens';

const strings = testStrings({
  wordCard: {
    tabs: { essence: 'Essence', example: 'Example', links: 'Links', history: 'History' },
    tabMore: 'More',
    tabLess: 'Less',
    partsOfSpeech: { noun: { short: 'n.', full: 'noun' } },
    genders: {},
    partOfSpeechWithGender: '{partOfSpeech}, {gender}',
    registers: { dialectal: { short: 'dial.', full: 'dialectal' } },
    registerWithRegion: '{register}, {region}',
    category: 'Category: {category}',
    linkLabels: {
      synonyms: { one: 'Synonym', many: 'Synonyms' },
      antonyms: { one: 'Antonym', many: 'Antonyms' },
    },
    example: '{text}',
    exampleAuthor: '— {author}',
    reveal: 'Show the meaning',
    pronunciation: { label: 'Pronounce', stop: 'Stop', noVoice: 'No voice' },
    stress: 'stress on {vowels}',
    stressOr: 'or',
    etymology: 'Etymology',
    history: 'History of the word',
    synonymRow: 'In the synonym row: {dominant}',
    synonymRowHint: 'Opens the synonym row',
  },
  idiomCard: {
    tabs: { essence: 'Essence', origin: 'Origin', example: 'Example' },
    idiomTypes: { idiom: 'idiom', placeName: 'place name', proverb: 'proverb' },
    heading: '{expression}, {type}',
    etymology: 'Origin',
    source: 'Source: {source}',
  },
  correctionCard: {
    tabs: { better: 'Better', why: 'Why', examples: 'Examples' },
    title: 'Correction',
    correctionType: 'Type: {type}',
    correctionTypes: {
      calque: 'calque',
      anglicism: 'anglicism',
      wrongStress: 'stress',
      paronym: 'paronyms',
    },
    nonStandard: 'Non-standard',
    standard: 'Standard',
    otherEquivalents: 'Also: {equivalents}',
    exampleNonStandard: 'Not: {text}',
    exampleStandard: 'Right: {text}',
    source: 'Source: {source}',
    howToSay: 'How to say it?',
    reveal: 'Show',
    literaryUses: 'How it is really written',
    literaryUseSource: '{author}, {work}',
    literaryUseSourceWithYear: '{author}, {work}, {year}',
  },
  wordOfTheDay: {
    badge: 'Word of the day · {day} {month}',
    kicker: 'Word of the day · {day}.{month}',
  },
  dates: { months: [] },
  knowledge: {
    known: 'Known',
    unknown: 'Unknown',
    review: 'Review',
  },
});

const correctionCard: CorrectionCardModel = {
  kind: 'correction',
  correctionId: 'c1',
  nonStandardForm: 'take part',
  nonStandardStressedVowels: [],
  mainEquivalent: 'join in',
  mainEquivalentStressedVowels: [],
  otherEquivalents: [],
  correctionType: 'calque',
  categoryId: 'everyday',
  categoryName: 'Everyday speech',
  explanation: 'A long explanation.',
  examplePair: {
    nonStandard: 'I take part.',
    standard: 'I join in.',
    standardSegments: [
      { kind: 'text', text: 'I ' },
      { kind: 'standardForm', text: 'join in' },
      { kind: 'text', text: '.' },
    ],
  },
  sourceNames: [],
  literaryUses: [],
};

const card: EntryFeedCard = { kind: 'correction', entryId: 'c1', model: correctionCard };

/** A stress trap: the Correction Type `wrongStress`, its forms marked. */
const stressTrap: EntryFeedCard = {
  kind: 'correction',
  entryId: 'c1',
  model: {
    ...correctionCard,
    correctionType: 'wrongStress',
    nonStandardForm: 'ca\u0301talog',
    nonStandardStressedVowels: ['a'],
    mainEquivalent: 'catalo\u0301g',
    mainEquivalentStressedVowels: ['o'],
    explanation: 'Say catalo\u0301g, as in dialo\u0301g.',
    examplePair: {
      nonStandard: 'Open the ca\u0301talog.',
      standard: 'Open the catalo\u0301g.',
      standardSegments: [
        { kind: 'text', text: 'Open the ' },
        { kind: 'standardForm', text: 'catalo\u0301g' },
        { kind: 'text', text: '.' },
      ],
    },
  },
};

/** A paronym: the Correction Type `paronym`, the swapped word in a phrase. */
const paronym: EntryFeedCard = {
  kind: 'correction',
  entryId: 'c2',
  model: {
    ...correctionCard,
    correctionId: 'c2',
    correctionType: 'paronym',
    nonStandardForm: 'an effective dress',
    mainEquivalent: 'an effectual dress',
    explanation: 'Effective works; effectual strikes the eye.',
    examplePair: {
      nonStandard: 'She wore an effective dress.',
      standard: 'She wore an effectual dress.',
      standardSegments: [
        { kind: 'text', text: 'She wore an ' },
        { kind: 'standardForm', text: 'effectual' },
        { kind: 'text', text: ' dress.' },
      ],
    },
  },
};

function cardWithSources(sourceNames: readonly string[]): EntryFeedCard {
  if (card.kind !== 'correction') throw new Error('The fixture is a Correction card');
  return { ...card, model: { ...card.model, sourceNames } };
}

const wordCard: WordFeedCard = {
  kind: 'word',
  entryId: 'w1',
  model: {
    kind: 'word',
    wordId: 'w1',
    lemma: 'lemma',
    stressedVowels: [],
    partOfSpeech: 'noun',
    gender: undefined,
    primaryDefinition: 'What it means.',
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
    sourceNames: [],
  },
};

/**
 * The longest Word of the Day the Ukrainian pack can show, its text as long as
 * the pack's (the UI holds no Ukrainian): the longest Lemma, «блискавковідвід»
 * (15 letters), with its Example (148 characters), carrying the longest
 * primary Definition, of «каніфоль» (246 characters).
 */
const longestWordOfTheDay = {
  kind: 'word',
  wordOfTheDay: { year: 2026, month: 10, day: 22 },
  entryId: 'w1',
  model: {
    ...wordCard.model,
    lemma: 'lightninggua\u0301rds',
    stressedVowels: ['a'],
    primaryDefinition:
      'Natural resin extracted from the sap of conifers; a hard, glassy, yellow or dark red substance that is used in making varnish, soap, rubber and paper, and so on, and also for rubbing bows of string instruments before they are played by musicians.',
    example: {
      text: 'After the successful test of the lightning rod built by Franklin on 10 May 1752, the science of electrical phenomena finally gained its recognition.',
    },
    categoryName: 'Engineering',
  },
} as const satisfies EntryFeedCard;

function inEdition(children: React.ReactNode) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      {children}
    </EditionProvider>
  );
}

describe('EntryCard', () => {
  it("shows the Edition's name of the wrong-stress Correction Type as the chip of a stress trap", async () => {
    await render(inEdition(<EntryCard card={stressTrap} />));

    expect(screen.getByText('stress')).toBeTruthy();
    expect(screen.getByLabelText('Type: stress')).toBeTruthy();
  });

  it("shows the Edition's name of the paronym Correction Type as the chip of a paronym", async () => {
    await render(inEdition(<EntryCard card={paronym} />));

    expect(screen.getByText('paronyms')).toBeTruthy();
    expect(screen.getByLabelText('Type: paronyms')).toBeTruthy();
    expect(screen.getByText('An effective dress')).toBeTruthy();
    expect(screen.getByText('An effectual dress')).toBeTruthy();
  });

  it('draws no source line on a Correction without sources', async () => {
    await render(inEdition(<EntryCard card={card} />));
    await fireEvent.press(screen.getByTestId('correction-tab-why'));

    expect(screen.getByTestId('correction-explanation')).toBeTruthy();
    expect(screen.queryByTestId('correction-source')).toBeNull();
  });

  it('names the Correction Type of an anglicism in its chip', async () => {
    const anglicism = { ...card.model, correctionType: 'anglicism' as const };

    await render(
      inEdition(<EntryCard card={{ kind: 'correction', entryId: 'c1', model: anglicism }} />),
    );

    const chip = screen.getByTestId('correction-type');
    expect(chip).toHaveTextContent('anglicism');
    expect(chip).toHaveProp('accessibilityLabel', 'Type: anglicism');
  });

  it('names the Category of a Correction in a chip, which VoiceOver reads as its Category', async () => {
    await render(inEdition(<EntryCard card={card} />));

    const chip = screen.getByTestId('correction-category');
    expect(chip).toHaveTextContent('Everyday speech');
    expect(chip).toHaveProp('accessibilityLabel', 'Category: Everyday speech');
  });

  it('draws no Category chip on a Correction whose Category the Language Pack does not have', async () => {
    const unnamed = { ...correctionCard, categoryName: undefined };

    await render(
      inEdition(<EntryCard card={{ kind: 'correction', entryId: 'c1', model: unnamed }} />),
    );

    expect(screen.queryByTestId('correction-category')).toBeNull();
  });

  it.each([
    ['Word', wordCard],
    ['Correction', card],
  ])('labels a %s card brought back for Review', async (_kind, entry) => {
    await render(inEdition(<EntryCard card={{ ...entry, review: true }} />));

    expect(screen.getByText('Review')).toBeTruthy();
  });

  it.each([
    ['Word', wordCard],
    ['Correction', card],
  ])('draws no Review label on any other %s card', async (_kind, entry) => {
    await render(inEdition(<EntryCard card={entry} />));

    expect(screen.queryByText('Review')).toBeNull();
  });

  it.each([
    ['Word', wordCard, 'Show the meaning'],
    ['Correction', card, 'Show'],
  ])('keeps the Review label on a %s card Self-check conceals', async (_kind, entry, reveal) => {
    await render(inEdition(<EntryCard card={{ ...entry, review: true }} selfCheck />));

    expect(screen.getByRole('button', { name: reveal })).toBeTruthy();
    expect(screen.getByText('Review')).toBeTruthy();
  });

  it('keeps the Category chip and the Pronunciation button on the longest Word of the Day on the SE', async () => {
    // The iPhone SE's window, which takes the compact layout.
    const window = Dimensions.get('window');
    Dimensions.set({ window: { width: 375, height: 667, scale: 2, fontScale: 1 } });
    const speak = jest.fn();

    try {
      await render(
        <EditionProvider
          edition={{ locale: 'en' }}
          strings={strings}
          pronunciation={() => (
            <PronunciationButton state="idle" onPress={speak} onDismissMessage={jest.fn()} />
          )}
        >
          <EntryCard card={longestWordOfTheDay} />
        </EditionProvider>,
      );

      expect(screen.getByTestId('word-lemma')).toHaveTextContent('Lightninggua\u0301rds');
      expect(screen.getByLabelText('Category: Engineering')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Pronounce' }));
      expect(speak).toHaveBeenCalledTimes(1);
    } finally {
      Dimensions.set({ window });
    }
  });
});

const wordWithEverything: WordFeedCard = {
  kind: 'word',
  entryId: 'w1',
  model: {
    ...wordCard.model,
    example: { text: 'An example.' },
    synonyms: ['alike'],
    categoryName: 'Rare',
  },
};

/** A dialect Word that names where it is said. */
const dialectWord: EntryFeedCard = {
  kind: 'word',
  entryId: 'w1',
  model: { ...wordWithEverything.model, registers: ['dialectal'], region: 'Hutsulshchyna' },
};

describe('the region of a dialect Word', () => {
  it('follows the dialectal register label on the card and in its VoiceOver label', async () => {
    await render(inEdition(<EntryCard card={dialectWord} />));

    expect(screen.getByTestId('word-register-dialectal')).toHaveTextContent('Dial., Hutsulshchyna');
    expect(screen.getByLabelText('dialectal, Hutsulshchyna')).toBeTruthy();
  });

  it('shows with the label once the reader reveals a Self-check card', async () => {
    await render(inEdition(<EntryCard card={dialectWord} selfCheck />));
    expect(screen.queryByTestId('word-register-dialectal')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));

    expect(screen.getByTestId('word-register-dialectal')).toHaveTextContent('Dial., Hutsulshchyna');
    expect(screen.getByLabelText('dialectal, Hutsulshchyna')).toBeTruthy();
  });
});

describe('the Word History on a Word card', () => {
  const history =
    'Fell out of use when the trade it named disappeared, and came back as a figure of speech.';
  const wordWithHistory: EntryFeedCard = { ...wordCard, model: { ...wordCard.model, history } };

  it('shows under its heading when the Word has history', async () => {
    await render(inEdition(<EntryCard card={wordWithHistory} />));

    const section = within(screen.getByTestId('word-history'));
    expect(section.getByRole('header', { name: 'History of the word' })).toBeTruthy();
    expect(section.getByText(history)).toBeTruthy();
  });

  it('is absent when the Word has none', async () => {
    await render(inEdition(<EntryCard card={wordCard} />));

    expect(screen.queryByTestId('word-history')).toBeNull();
    expect(screen.queryByText('History of the word')).toBeNull();
  });

  it('stays hidden under Self-check until revealed', async () => {
    await render(inEdition(<EntryCard card={wordWithHistory} selfCheck />));
    expect(screen.queryByTestId('word-history')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));

    expect(screen.getByTestId('word-history')).toBeTruthy();
  });

  it('wraps its whole text at the largest font size', async () => {
    const window = Dimensions.get('window');
    Dimensions.set({ window: { ...window, fontScale: 3.12 } });

    try {
      await render(inEdition(<EntryCard card={wordWithHistory} />));

      const text = within(screen.getByTestId('word-history')).getByText(history);
      expect(text).not.toHaveProp('numberOfLines');
      expect(text).not.toHaveProp('adjustsFontSizeToFit');
    } finally {
      Dimensions.set({ window });
    }
  });
});

describe('the Synonym Row line on a Word card', () => {
  const wordInRow: EntryFeedCard = {
    ...wordCard,
    model: {
      ...wordCard.model,
      synonymRow: {
        synonymRowId: 'r_go',
        dominant: { text: 'go\u0301', stressedVowels: ['o'], wordId: 'w_go' },
      },
    },
  };

  it('names the dominant of the row the Word is a member of', async () => {
    await render(inEdition(<EntryCard card={wordInRow} />));

    const line = within(screen.getByTestId('word-synonym-row'));
    expect(line.getByText(/^In the synonym row: /)).toBeTruthy();
    expect(line.getByText('Go\u0301')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'In the synonym row: go, stress on o' }),
    ).toBeTruthy();
  });

  it('opens the row on a tap', async () => {
    const onOpenSynonymRow = jest.fn();
    await render(inEdition(<EntryCard card={wordInRow} onOpenSynonymRow={onOpenSynonymRow} />));

    await fireEvent.press(
      screen.getByRole('button', { name: 'In the synonym row: go, stress on o' }),
    );

    expect(onOpenSynonymRow).toHaveBeenCalledWith('r_go');
  });

  it('is absent when the Word is in no row', async () => {
    await render(inEdition(<EntryCard card={wordCard} />));

    expect(screen.queryByTestId('word-synonym-row')).toBeNull();
    expect(screen.queryByText(/In the synonym row/)).toBeNull();
  });

  it('stays hidden under Self-check until revealed', async () => {
    await render(inEdition(<EntryCard card={wordInRow} selfCheck />));
    expect(screen.queryByTestId('word-synonym-row')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));

    expect(screen.getByTestId('word-synonym-row')).toBeTruthy();
  });
});

describe('Self-check on a Word card', () => {
  it('shows only the Lemma, part of speech and Category until revealed', async () => {
    await render(inEdition(<EntryCard card={wordWithEverything} selfCheck />));

    expect(screen.getByTestId('word-lemma')).toHaveTextContent('Lemma');
    expect(screen.getByTestId('word-part-of-speech')).toHaveTextContent('N.');
    expect(screen.getByTestId('word-category')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show the meaning' })).toBeTruthy();
    for (const concealedPart of ['word-definition', 'word-example', 'word-synonyms']) {
      expect(screen.queryByTestId(concealedPart)).toBeNull();
    }
  });

  it('shows the whole card once the reader taps «Show the meaning»', async () => {
    await render(inEdition(<EntryCard card={wordWithEverything} selfCheck />));

    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));

    expect(screen.getByTestId('word-definition')).toHaveTextContent('What it means.');
    expect(screen.queryByRole('button', { name: 'Show the meaning' })).toBeNull();
    await fireEvent.press(screen.getByTestId('word-tab-example'));
    expect(screen.getByTestId('word-example')).toHaveTextContent('An example.');
  });

  it('keeps the Word of the Day badge on a concealed card', async () => {
    await render(
      inEdition(
        <EntryCard
          card={{ ...wordWithEverything, wordOfTheDay: { year: 2026, month: 10, day: 19 } }}
          selfCheck
        />,
      ),
    );

    expect(screen.getByTestId('word-of-the-day-badge')).toBeTruthy();
    expect(screen.queryByTestId('word-definition')).toBeNull();
  });
});

function correctionWithEverything(): EntryFeedCard {
  const withSources = cardWithSources(['A dictionary']);
  if (withSources.kind !== 'correction') throw new Error('The fixture is a Correction card');
  return {
    ...withSources,
    model: { ...withSources.model, otherEquivalents: ['take a hand'] },
  };
}

describe('Self-check on a Correction card', () => {
  it('shows only the non-standard form and asks how to say it until revealed', async () => {
    await render(inEdition(<EntryCard card={correctionWithEverything()} selfCheck />));

    expect(screen.getByTestId('correction-non-standard')).toBeTruthy();
    expect(screen.getByText('Take part')).toBeTruthy();
    expect(screen.getByText('How to say it?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show' })).toBeTruthy();
    for (const concealedPart of [
      'correction-type',
      'correction-category',
      'correction-standard',
      'correction-other-equivalents',
      'correction-explanation',
      'correction-example-pair',
      'correction-source',
    ]) {
      expect(screen.queryByTestId(concealedPart)).toBeNull();
    }
    expect(screen.queryByText('Join in')).toBeNull();
  });

  it('shows the right form and the explanation once the reader taps «Show»', async () => {
    await render(inEdition(<EntryCard card={correctionWithEverything()} selfCheck />));

    await fireEvent.press(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByTestId('correction-standard')).toBeTruthy();
    expect(screen.queryByText('How to say it?')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show' })).toBeNull();
    await fireEvent.press(screen.getByTestId('correction-tab-why'));
    expect(screen.getByTestId('correction-explanation')).toHaveTextContent('A long explanation.');
    await fireEvent.press(screen.getByTestId('correction-tab-examples'));
    expect(screen.getByTestId('correction-example-pair')).toBeTruthy();
  });
});

describe('the standard form on a Correction card', () => {
  it("starts the main equivalent at the standard form's title size", async () => {
    await render(inEdition(<EntryCard card={card} />));

    const form = within(screen.getByTestId('correction-standard')).getByText('Join in');
    expect(form).toHaveStyle({ fontSize: typeRoles.correctionStandard.size });
    expect(form).toHaveProp('maxFontSizeMultiplier', 1.5);
  });
});

describe('the literary uses on a Correction card', () => {
  const withUses: EntryFeedCard = {
    kind: 'correction',
    entryId: 'c1',
    model: {
      ...correctionCard,
      literaryUses: [
        {
          text: 'They all joined in the song.',
          author: 'An Author',
          work: 'A Long Poem',
          authorDeathYear: 1861,
          workYear: 1840,
        },
        {
          text: 'Join in, he said.',
          author: 'Another Author',
          work: 'A Tale',
          authorDeathYear: 1916,
        },
      ],
    },
  };

  it('shows each use with its author, work and year under the heading when the Correction has uses', async () => {
    await render(inEdition(<EntryCard card={withUses} />));
    await fireEvent.press(screen.getByTestId('correction-tab-examples'));

    const section = within(screen.getByTestId('correction-literary-uses'));
    expect(section.getByRole('header', { name: 'How it is really written' })).toBeTruthy();
    expect(section.getByText('They all joined in the song.')).toBeTruthy();
    expect(section.getByText('— An Author, A Long Poem, 1840')).toBeTruthy();
    expect(section.getByText('Join in, he said.')).toBeTruthy();
    expect(section.getByText('— Another Author, A Tale')).toBeTruthy();
  });

  it('is absent when the Correction has none', async () => {
    await render(inEdition(<EntryCard card={card} />));
    await fireEvent.press(screen.getByTestId('correction-tab-examples'));

    expect(screen.getByTestId('correction-example-pair')).toBeTruthy();
    expect(screen.queryByTestId('correction-literary-uses')).toBeNull();
    expect(screen.queryByText('How it is really written')).toBeNull();
  });

  it('stays hidden under Self-check until revealed', async () => {
    await render(inEdition(<EntryCard card={withUses} selfCheck />));
    expect(screen.queryByTestId('correction-standard')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Show' }));
    await fireEvent.press(screen.getByTestId('correction-tab-examples'));

    expect(screen.getByTestId('correction-literary-uses')).toBeTruthy();
  });

  it('wraps every use whole at the largest font size', async () => {
    const window = Dimensions.get('window');
    Dimensions.set({ window: { ...window, fontScale: 3.12 } });

    try {
      await render(inEdition(<EntryCard card={withUses} />));
      await fireEvent.press(screen.getByTestId('correction-tab-examples'));

      const section = within(screen.getByTestId('correction-literary-uses'));
      for (const text of ['They all joined in the song.', '— An Author, A Long Poem, 1840']) {
        expect(section.getByText(text)).not.toHaveProp('numberOfLines');
        expect(section.getByText(text)).not.toHaveProp('adjustsFontSizeToFit');
      }
    } finally {
      Dimensions.set({ window });
    }
  });
});

describe('VoiceOver on a stress trap', () => {
  it('says where the Stress of each form falls on the card', async () => {
    await render(inEdition(<EntryCard card={stressTrap} />));

    expect(screen.getByTestId('correction-non-standard')).toHaveProp(
      'accessibilityLabel',
      'Non-standard, stress: catalog, stress on a',
    );
    expect(screen.getByTestId('correction-standard')).toHaveProp(
      'accessibilityLabel',
      'Standard: catalog, stress on o. Category: Everyday speech',
    );
  });

  it('reads the explanation and the example pair without the Stress mark', async () => {
    await render(inEdition(<EntryCard card={stressTrap} />));
    await fireEvent.press(screen.getByTestId('correction-tab-why'));

    expect(screen.getByTestId('correction-explanation')).toHaveProp(
      'accessibilityLabel',
      'Say catalog, as in dialog.',
    );
    await fireEvent.press(screen.getByTestId('correction-tab-examples'));
    expect(screen.getByLabelText('Not: Open the catalog.')).toBeTruthy();
    expect(screen.getByLabelText('Right: Open the catalog.')).toBeTruthy();
  });

  it('says where the Stress of the non-standard form falls in Self-check', async () => {
    await render(inEdition(<EntryCard card={stressTrap} selfCheck />));

    expect(screen.getByTestId('correction-non-standard')).toHaveProp(
      'accessibilityLabel',
      'Non-standard: catalog, stress on a',
    );
  });

  it('reads the forms of another Correction Type as written', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.getByLabelText('Non-standard, calque: take part')).toBeTruthy();
    expect(screen.getByLabelText('Standard: join in. Category: Everyday speech')).toBeTruthy();
  });
});

function idiomCard(overrides: Partial<IdiomCardModel> = {}): IdiomCardModel {
  return {
    kind: 'idiom',
    idiomId: 'i1',
    expression: 'to beat the bushes',
    idiomType: 'idiom',
    primaryDefinition: 'To idle about.',
    extraDefinitions: ['To search everywhere.'],
    examples: [{ text: 'He beat the bushes all day.' }, { text: 'Stop beating the bushes.' }],
    etymology: 'From the hunt.',
    sourceNames: ['A phrase dictionary'],
    ...overrides,
  };
}

/** A place name, whose story is its etymology. */
const placeName = idiomCard({
  idiomId: 'i2',
  expression: 'Berdychiv',
  idiomType: 'placeName',
  primaryDefinition: 'A town in the Zhytomyr region.',
  extraDefinitions: [],
  examples: [{ text: 'They drove to Berdychiv.' }],
  etymology: 'Named after the Berdy tribe.',
  sourceNames: [],
});

/** A proverb: the Idiom card with its own chip. */
const proverb = idiomCard({
  idiomId: 'i3',
  expression: 'the early bird catches the worm',
  idiomType: 'proverb',
  primaryDefinition: 'Who starts early, wins.',
  extraDefinitions: [],
  examples: [],
  etymology: undefined,
  sourceNames: ['A book of proverbs'],
});

describe('the Idiom card', () => {
  it('shows the expression, its chip, Definitions, Examples, «Origin» and sources of an idiom', async () => {
    await render(
      inEdition(<EntryCard card={{ kind: 'idiom', entryId: 'i1', model: idiomCard() }} />),
    );

    expect(screen.getByTestId('idiom-expression')).toHaveTextContent('To beat the bushes');
    expect(screen.getByTestId('idiom-type')).toHaveTextContent('idiom');
    expect(
      screen.getAllByRole('tab').map((tab) => tab.props['accessibilityLabel'] as string),
    ).toEqual(['Essence', 'Origin', 'Example']);
    expect(screen.getByTestId('idiom-definition')).toHaveTextContent('To idle about.');
    expect(screen.getByText('2. To search everywhere.')).toBeTruthy();
    expect(screen.getByTestId('idiom-source')).toHaveTextContent('Source: A phrase dictionary');
    await fireEvent.press(screen.getByTestId('idiom-tab-origin'));
    expect(screen.getByTestId('idiom-etymology')).toHaveTextContent('From the hunt.');
    await fireEvent.press(screen.getByTestId('idiom-tab-example'));
    expect(screen.getByTestId('idiom-example')).toHaveTextContent('He beat the bushes all day.');
    expect(screen.getByText('Stop beating the bushes.')).toBeTruthy();
  });

  it('shows the chip «place name» on a place name card, and only the sections it has', async () => {
    await render(
      inEdition(<EntryCard card={{ kind: 'idiom', entryId: 'i2', model: placeName }} />),
    );

    expect(screen.getByTestId('idiom-expression')).toHaveTextContent('Berdychiv');
    expect(screen.getByTestId('idiom-type')).toHaveTextContent('place name');
    expect(screen.getByTestId('idiom-definition')).toHaveTextContent(
      'A town in the Zhytomyr region.',
    );
    expect(screen.queryByText(/^2\. /)).toBeNull();
    expect(screen.queryByTestId('idiom-source')).toBeNull();
    await fireEvent.press(screen.getByTestId('idiom-tab-origin'));
    expect(screen.getByTestId('idiom-etymology')).toHaveTextContent('Named after the Berdy tribe.');
    await fireEvent.press(screen.getByTestId('idiom-tab-example'));
    expect(screen.getByText('They drove to Berdychiv.')).toBeTruthy();
  });

  it('shows the chip «proverb» on a proverb card', async () => {
    await render(inEdition(<EntryCard card={{ kind: 'idiom', entryId: 'i3', model: proverb }} />));

    expect(screen.getByTestId('idiom-expression')).toHaveTextContent(
      'The early bird catches the worm',
    );
    expect(screen.getByTestId('idiom-type')).toHaveTextContent('proverb');
    expect(screen.getByTestId('idiom-definition')).toHaveTextContent('Who starts early, wins.');
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it.each([
    ['a short expression', placeName],
    ['a longer one', idiomCard()],
    ['a long one', proverb],
  ])("starts %s at the expression's title size, whatever its length", async (_case, model) => {
    await render(inEdition(<EntryCard card={{ kind: 'idiom', entryId: 'i1', model }} />));

    expect(screen.getByTestId('idiom-expression')).toHaveStyle({
      fontSize: typeRoles.idiomExpression.size,
    });
  });

  it.each([
    ['an idiom', idiomCard(), 'to beat the bushes, idiom', 'To idle about.'],
    ['a place name', placeName, 'Berdychiv, place name', 'A town in the Zhytomyr region.'],
    ['a proverb', proverb, 'the early bird catches the worm, proverb', 'Who starts early, wins.'],
  ])(
    'has VoiceOver read the expression of %s with its kind, then its Definition',
    async (_kind, model, heading, definition) => {
      await render(
        inEdition(<EntryCard card={{ kind: 'idiom', entryId: model.idiomId, model }} />),
      );

      expect(screen.getByRole('header', { name: heading })).toBeTruthy();
      expect(screen.getByTestId('idiom-definition')).toHaveTextContent(definition);
    },
  );

  it('keeps the expression and its chip under Self-check and shows the rest once revealed', async () => {
    await render(
      inEdition(
        <EntryCard card={{ kind: 'idiom', entryId: 'i1', model: idiomCard() }} selfCheck />,
      ),
    );

    expect(screen.getByRole('header', { name: 'to beat the bushes, idiom' })).toBeTruthy();
    expect(screen.queryByTestId('idiom-definition')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));

    expect(screen.getByTestId('idiom-definition')).toHaveTextContent('To idle about.');
    await fireEvent.press(screen.getByTestId('idiom-tab-origin'));
    expect(screen.getByTestId('idiom-etymology')).toHaveTextContent('From the hunt.');
  });
});

describe('VoiceOver on Entry texts with a Stress mark', () => {
  const stressedWord: EntryFeedCard = {
    ...wordCard,
    model: {
      ...wordCard.model,
      primaryDefinition: 'Same as adónis.',
      example: { text: 'The adónis bloomed.', author: 'A poét' },
      history: 'Named after Adónis.',
      synonyms: ['pheasant́ eye'],
      details: {
        extraDefinitions: ['A handsome yóuth.'],
        examples: [{ text: 'He was an adónis.' }],
        etymology: 'From the Greék.',
      },
    },
  };

  it('shows the Stress marks on a Word card and reads its texts without them', async () => {
    await render(inEdition(<EntryCard card={stressedWord} />));

    expect(screen.getByTestId('word-definition')).toHaveTextContent('Same as adónis.');
    expect(screen.getByTestId('word-definition')).toHaveProp(
      'accessibilityLabel',
      'Same as adonis.',
    );
    expect(screen.getByText('Named after Adónis.', { includeHiddenElements: true })).toHaveProp(
      'accessibilityLabel',
      'Named after Adonis.',
    );
    await fireEvent.press(screen.getByTestId('word-tab-example'));
    expect(screen.getByTestId('word-example')).toHaveTextContent('The adónis bloomed.— A poét');
    expect(screen.getByTestId('word-example')).toHaveProp(
      'accessibilityLabel',
      'The adonis bloomed. — A poet',
    );
    expect(
      screen.getByLabelText('He was an adonis.', { includeHiddenElements: true }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('word-tab-links'));
    expect(screen.getByTestId('word-synonyms')).toHaveTextContent(/^Synonym/);
    expect(screen.getByLabelText('pheasant eye')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('word-tab-history'));
    // The History tab composes the etymology (NFC), so its Stress mark is one letter.
    expect(screen.getByText('From the Gre\u00e9k.')).toBeTruthy();
  });

  it('shows every Definition in the Essence tab, the others numbered on from the primary one', async () => {
    await render(inEdition(<EntryCard card={stressedWord} />));

    expect(
      within(screen.getByTestId('word-meanings')).getByText('2. A handsome yóuth.', {
        includeHiddenElements: true,
      }),
    ).toHaveProp('accessibilityLabel', '2. A handsome youth.');
  });

  it('shows the etymology alone in the History tab', async () => {
    await render(inEdition(<EntryCard card={stressedWord} />));
    await fireEvent.press(screen.getByTestId('word-tab-history'));

    expect(screen.getByTestId('word-etymology')).toBeTruthy();
    expect(screen.queryByTestId('word-meanings')).toBeNull();
    expect(screen.queryByTestId('word-history')).toBeNull();
  });

  it('shows the Stress marks on an Idiom card and reads its texts without them', async () => {
    const stressedIdiom = idiomCard({
      expression: 'to beát the bushes',
      primaryDefinition: 'To ídle about.',
      extraDefinitions: ['To seárch everywhere.'],
      examples: [{ text: 'He beát the bushes all day.' }],
      etymology: 'From the húnt.',
    });
    await render(
      inEdition(<EntryCard card={{ kind: 'idiom', entryId: 'i1', model: stressedIdiom }} />),
    );

    expect(screen.getByRole('header', { name: 'to beat the bushes, idiom' })).toBeTruthy();
    expect(screen.getByTestId('idiom-definition')).toHaveTextContent('To ídle about.');
    expect(screen.getByTestId('idiom-definition')).toHaveProp(
      'accessibilityLabel',
      'To idle about.',
    );
    expect(screen.getByText('2. To seárch everywhere.')).toHaveProp(
      'accessibilityLabel',
      '2. To search everywhere.',
    );
    await fireEvent.press(screen.getByTestId('idiom-tab-example'));
    expect(screen.getByTestId('idiom-example')).toHaveProp(
      'accessibilityLabel',
      'He beat the bushes all day.',
    );
    await fireEvent.press(screen.getByTestId('idiom-tab-origin'));
    expect(screen.getByText('From the húnt.')).toHaveProp('accessibilityLabel', 'From the hunt.');
  });
});

/** A corner button that reads whether the card is concealed, as the corner's actions do. */
function CornerStandIn() {
  const concealed = useConcealed();
  return <Pressable accessibilityRole="button" accessibilityLabel="Known" disabled={concealed} />;
}

describe('the corner of an Entry card', () => {
  /** A button stands in the corner, disabled while the card is concealed. */
  const cornerMarks = <CornerStandIn />;

  it('draws the corner in the card, with no action row', async () => {
    await render(
      inEdition(
        <EntryCard card={wordWithEverything} slots={{ corner: cornerMarks, swipe: undefined }} />,
      ),
    );

    expect(
      within(screen.getByTestId('word-corner')).getByRole('button', { name: 'Known' }),
    ).toBeEnabled();
    expect(screen.queryByTestId('word-actions')).toBeNull();
  });

  it('sets the corner in one row beside the kicker of the Word of the Day, never over it', async () => {
    await render(
      inEdition(
        <EntryCard
          card={{ ...wordWithEverything, wordOfTheDay: { year: 2026, month: 11, day: 5 } }}
          slots={{ corner: cornerMarks, swipe: undefined }}
        />,
      ),
    );

    const row = screen.getByTestId('word-kicker-row');
    expect(within(row).getByTestId('word-of-the-day-kicker')).toBeOnTheScreen();
    expect(within(row).getByTestId('word-corner')).not.toHaveStyle({ position: 'absolute' });
    expect(within(row).queryByTestId('word-lemma')).toBeNull();
  });

  it('keeps the Correction kicker whole on one line beside the corner', async () => {
    await render(
      inEdition(<EntryCard card={card} slots={{ corner: cornerMarks, swipe: undefined }} />),
    );

    // Squeezed by the corner tiles, the kicker shrinks to fit rather than break inside its word.
    const title = within(screen.getByTestId('correction-kicker-row')).getByText('Correction');
    expect(title).toHaveProp('numberOfLines', 1);
    expect(title).toHaveProp('adjustsFontSizeToFit', true);
  });

  it.each<[string, EntryFeedCard, string | null]>([
    ['correction', card, 'Correction'],
    ['idiom', { kind: 'idiom', entryId: 'i1', model: idiomCard() }, null],
    ['word', wordWithEverything, null],
  ])(
    'gives the corner of the %s card a row of its own over the headline, beside its kicker if any',
    async (kind, entry, kicker) => {
      await render(
        inEdition(<EntryCard card={entry} slots={{ corner: cornerMarks, swipe: undefined }} />),
      );

      const row = screen.getByTestId(`${kind}-kicker-row`);
      expect(within(row).getByTestId(`${kind}-corner`)).not.toHaveStyle({ position: 'absolute' });
      if (kicker !== null) expect(within(row).getByText(kicker)).toBeOnTheScreen();
    },
  );

  it.each<[string, EntryFeedCard]>([
    ['correction', { ...card, review: true }],
    ['idiom', { kind: 'idiom', entryId: 'i1', model: idiomCard(), review: true }],
    ['word', { ...wordWithEverything, review: true }],
  ])(
    'sets the corner of a %s card brought back for Review in one row beside its Review label',
    async (kind, entry) => {
      await render(
        inEdition(<EntryCard card={entry} slots={{ corner: cornerMarks, swipe: undefined }} />),
      );

      const row = screen.getByTestId(`${kind}-review-row`);
      expect(within(row).getByTestId('review-label')).toBeOnTheScreen();
      expect(within(row).getByTestId(`${kind}-corner`)).toBeOnTheScreen();
      expect(screen.getAllByTestId(`${kind}-corner`)).toHaveLength(1);
    },
  );

  it('draws no kicker row without a corner', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.queryByTestId('correction-kicker-row')).toBeNull();
  });

  it('has no corner when none is given', async () => {
    await render(inEdition(<EntryCard card={wordWithEverything} />));

    expect(screen.queryByTestId('word-corner')).toBeNull();
  });

  it('keeps the corner concealed under Self-check until the reader reveals the card', async () => {
    await render(
      inEdition(
        <EntryCard
          card={wordWithEverything}
          slots={{ corner: cornerMarks, swipe: undefined }}
          selfCheck
        />,
      ),
    );

    const known = () =>
      within(screen.getByTestId('word-corner')).getByRole('button', { name: 'Known' });
    expect(known()).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));
    expect(known()).toBeEnabled();
  });
});

describe("a Word card's kicker", () => {
  it("says the card's place in its Category's Feed", async () => {
    const kicker = 'CATEGORY · EMOTIONS · 2 OF 4';
    await render(inEdition(<EntryCard card={wordCard} kicker={kicker} />));
    expect(screen.getByTestId('word-card-kicker')).toHaveTextContent(kicker);
    // Level with the corner tiles' middle, as the board's CSS centres it (EntryKicker).
    expect(StyleSheet.flatten(screen.getByTestId('word-card-kicker').props['style'])).toMatchObject(
      {
        transform: [{ translateY: tightLineDrop('cardKicker') }],
      },
    );
  });

  it.each<[string, EntryFeedCard]>([
    ['correction', card],
    ['idiom', { kind: 'idiom', entryId: 'i1', model: idiomCard() }],
  ])(
    "says the %s card's place in a Curated Collection's Feed over its own kicker",
    async (kind, entry) => {
      const kicker = 'COLLECTION · PICKS · 3 OF 5';
      await render(inEdition(<EntryCard card={entry} kicker={kicker} />));

      expect(screen.getByTestId(`${kind}-card-kicker`)).toHaveTextContent(kicker);
      expect(screen.getByTestId(`${kind}-card`)).toBeOnTheScreen();
    },
  );

  it('is left out of a Word card in the Feed', async () => {
    await render(inEdition(<EntryCard card={wordCard} />));

    expect(screen.queryByTestId('word-card-kicker')).toBeNull();
  });
});

describe('the frame of a tabbed Entry card (board XEntry2)', () => {
  it.each([
    ['word', wordCard],
    ['correction', card],
    ['idiom', { kind: 'idiom', entryId: 'i1', model: placeName }],
  ] as const)(
    'draws a %s card at radius 24, outlined 2.5, padded 20/22/18, blocks 16 apart',
    async (kind, entry) => {
      await render(inEdition(<EntryCard card={entry} />));

      expect(screen.getByTestId(`${kind}-card`)).toHaveStyle({
        borderRadius: 24,
        borderWidth: 2.5,
        paddingTop: 20,
        paddingHorizontal: 22,
        paddingBottom: 18,
        gap: 16,
      });
    },
  );
});

describe('the page an Entry card lays itself out on', () => {
  /** Names the card's fixed frame `page-frame` and its scroll `page-scroll`. */
  const page = { testID: 'page', clearance: { framed: 54, scrolled: 62 } };
  const wordOfTheDay = { ...wordWithEverything, wordOfTheDay: { year: 2026, month: 11, day: 5 } };

  it('is a fixed frame for an Entry card', async () => {
    await render(onPager(<EntryCard card={wordCard} page={page} />));

    expect(within(screen.getByTestId('page-frame')).getByTestId('word-card')).toBeTruthy();
  });

  it('scrolls the red Word of the Day card while Self-check keeps it closed, and frames it once revealed', async () => {
    await render(onPager(<EntryCard card={wordOfTheDay} selfCheck page={page} />));

    expect(screen.getByTestId('page-scroll')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('word-reveal'));

    expect(screen.getByTestId('page-frame')).toBeTruthy();
  });

  it('starts the card under the room its page leaves above it, framed or scrolled', async () => {
    await render(onPager(<EntryCard card={wordOfTheDay} selfCheck page={page} />));

    expect(screen.getByTestId('page-scroll')).toHaveProp(
      'contentContainerStyle',
      expect.arrayContaining([{ paddingTop: 62 }]),
    );

    await fireEvent.press(screen.getByTestId('word-reveal'));

    expect(screen.getByTestId('page-frame')).toHaveStyle({
      paddingTop: 54,
      paddingHorizontal: 12,
      paddingBottom: 24,
    });
  });
});

/** The card in the Edition, under the root its page's scroll needs. */
function onPager(children: React.ReactNode) {
  return <GestureHandlerRootView>{inEdition(children)}</GestureHandlerRootView>;
}

describe('the Source tab of a tabbed Entry card (ADR 0116)', () => {
  const sourceStrings = testStrings({
    ...strings,
    wordCard: { ...strings.wordCard, tabSource: 'Source' },
  });
  const sourced = ['A dictionary', 'A book of proverbs'];
  const cases = [
    ['word', { ...wordCard, model: { ...wordCard.model, sourceNames: sourced } }],
    ['correction', cardWithSources(sourced)],
    ['idiom', { kind: 'idiom', entryId: 'i1', model: idiomCard({ sourceNames: sourced }) }],
  ] as const;

  /** The source line of the kind's own tabs, in any of them. */
  async function sourceLineInOwnTabs(kind: string): Promise<boolean> {
    let found = false;
    for (const tab of screen.getAllByRole('tab')) {
      if (tab.props['testID'] === `${kind}-tab-source`) continue;
      await fireEvent.press(tab);
      if (screen.queryByTestId(`${kind}-source`) !== null) found = true;
    }
    return found;
  }

  it.each(cases)(
    'is the last tab of a %s card, each source on its own line, and the other tabs lose the source line',
    async (kind, entry) => {
      await render(
        <EditionProvider edition={{ locale: 'en' }} strings={sourceStrings}>
          <EntryCard card={entry} sourceTab />
        </EditionProvider>,
      );

      const tabs = screen.getAllByRole('tab');
      expect(tabs.at(-1)).toBe(screen.getByTestId(`${kind}-tab-source`));
      expect(screen.getByTestId(`${kind}-tab-source`)).toHaveProp('accessibilityLabel', 'Source');
      expect(await sourceLineInOwnTabs(kind)).toBe(false);

      await fireEvent.press(screen.getByTestId(`${kind}-tab-source`));

      expect(screen.getByTestId(`${kind}-source-0`)).toHaveTextContent('A dictionary', {
        exact: true,
      });
      expect(screen.getByTestId(`${kind}-source-1`)).toHaveTextContent('A book of proverbs', {
        exact: true,
      });
    },
  );

  it.each(cases.filter(([kind]) => kind !== 'word'))(
    'is not there while the switch is off: a %s card keeps its source line in its tab',
    async (kind, entry) => {
      await render(
        <EditionProvider edition={{ locale: 'en' }} strings={sourceStrings}>
          <EntryCard card={entry} />
        </EditionProvider>,
      );

      expect(screen.queryByTestId(`${kind}-tab-source`)).toBeNull();
      expect(await sourceLineInOwnTabs(kind)).toBe(true);
    },
  );
});

describe('the texts of a Word card', () => {
  it('start with a capital, whatever case the content has (owner decision 11)', async () => {
    const lowercase: WordFeedCard = {
      ...wordCard,
      model: {
        ...wordCard.model,
        primaryDefinition: 'what it means.',
        example: { text: 'an example.' },
        synonyms: ['alike'],
        history: 'a story.',
        categoryName: 'rare',
      },
    };
    await render(inEdition(<EntryCard card={lowercase} />));

    expect(screen.getByTestId('word-lemma')).toHaveTextContent(/^Lemma$/);
    expect(screen.getByTestId('word-definition')).toHaveTextContent('What it means.');
    expect(screen.getByTestId('word-category')).toHaveTextContent('Rare');
    expect(screen.getByTestId('word-history', { includeHiddenElements: true })).toHaveTextContent(
      /A story\./,
    );
    await fireEvent.press(screen.getByTestId('word-tab-example'));
    expect(screen.getByTestId('word-example')).toHaveTextContent(/An example\./);
    await fireEvent.press(screen.getByTestId('word-tab-links'));
    expect(screen.getByTestId('word-synonyms')).toHaveTextContent(/Alike$/);
  });
});
