import type { EditionStrings } from '@slovo/contracts';
import {
  coreDecor,
  type CorrectionCardModel,
  type Decor,
  type EntryFeedCard,
  type IdiomCardModel,
  type WordFeedCard,
} from '@slovo/core';
import {
  ActionRow,
  DecorProvider,
  EditionProvider,
  EntryCard,
  KnowledgeButtons,
  PronunciationButton,
} from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Dimensions, Text } from 'react-native';

const strings = {
  wordCard: {
    partsOfSpeech: { noun: { short: 'n.', full: 'noun' } },
    genders: {},
    partOfSpeechWithGender: '{partOfSpeech}, {gender}',
    registers: { dialectal: { short: 'dial.', full: 'dialectal' } },
    registerWithRegion: '{register}, {region}',
    category: '{category}',
    synonym: 'Synonym',
    synonyms: 'Synonyms',
    antonym: 'Antonym',
    antonyms: 'Antonyms',
    example: '{text}',
    reveal: 'Show the meaning',
    pronunciation: { label: 'Pronounce', stop: 'Stop', noVoice: 'No voice' },
    stress: 'stress on {vowels}',
    stressOr: 'or',
    extraDefinitions: 'Other meanings',
  },
  idiomCard: {
    idiomTypes: { idiom: 'idiom', placeName: 'place name', proverb: 'proverb' },
    heading: '{expression}, {type}',
    etymology: 'Origin',
    source: 'Source: {source}',
  },
  correctionCard: {
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
  },
  wordOfTheDay: { badge: 'Word of the day · {day} {month}', months: [] },
  knowledge: {
    known: 'Known',
    unknown: 'Unknown',
    correctionKnownHint: 'I already say it right',
    review: 'Review',
  },
} as unknown as EditionStrings;

const correctionCard: CorrectionCardModel = {
  kind: 'correction',
  correctionId: 'c1',
  nonStandardForm: 'take part',
  nonStandardStressedVowels: [],
  mainEquivalent: 'join in',
  mainEquivalentStressedVowels: [],
  otherEquivalents: [],
  correctionType: 'calque',
  explanation: 'A long explanation.',
  examplePair: { nonStandard: 'I take part.', standard: 'I join in.' },
  sourceTitles: [],
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
    examplePair: { nonStandard: 'Open the ca\u0301talog.', standard: 'Open the catalo\u0301g.' },
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
    },
  },
};

function cardWithSources(sourceTitles: readonly string[]): EntryFeedCard {
  if (card.kind !== 'correction') throw new Error('The fixture is a Correction card');
  return { ...card, model: { ...card.model, sourceTitles } };
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

const motif = {
  width: 4,
  height: 4,
  layers: [{ path: 'M0 0h4v4H0z', light: '#000', dark: '#fff' }],
};
const framedDecor: Decor = { ...coreDecor, corners: { corner: motif } };

function inEdition(children: React.ReactNode) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      {children}
    </EditionProvider>
  );
}

describe('EntryCard', () => {
  it.each([
    ['Word', wordCard, 'word-card'],
    ['Correction', card, 'correction-card'],
    ['Idiom', { kind: 'idiom' as const, entryId: 'i1', model: idiomCard() }, 'idiom-card'],
  ])('draws the Decor frame on a %s card in all four corners', async (_kind, entry, testID) => {
    await render(
      inEdition(
        <DecorProvider decor={framedDecor}>
          <EntryCard card={entry} />
        </DecorProvider>,
      ),
    );

    const frame = within(screen.getByTestId(testID));
    for (const corner of ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']) {
      expect(frame.getByTestId(`card-corner-${corner}`, { hidden: true })).toBeTruthy();
    }
  });

  it("shows the Edition's name of the wrong-stress Correction Type as the chip of a stress trap", async () => {
    await render(inEdition(<EntryCard card={stressTrap} />));

    expect(screen.getByText('stress')).toBeTruthy();
    expect(screen.getByLabelText('Type: stress')).toBeTruthy();
  });

  it("shows the Edition's name of the paronym Correction Type as the chip of a paronym", async () => {
    await render(inEdition(<EntryCard card={paronym} />));

    expect(screen.getByText('paronyms')).toBeTruthy();
    expect(screen.getByLabelText('Type: paronyms')).toBeTruthy();
    expect(screen.getByText('an effective dress')).toBeTruthy();
    expect(screen.getByText('an effectual dress')).toBeTruthy();
  });

  it('names the sources of a Correction in a line under the example pair', async () => {
    await render(inEdition(<EntryCard card={cardWithSources(['Sources A', 'Sources B'])} />));

    expect(screen.getByTestId('correction-source')).toHaveTextContent(
      'Source: Sources A; Sources B',
    );
  });

  it('draws no source line on a Correction without sources', async () => {
    await render(inEdition(<EntryCard card={card} />));

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

  it('draws no frame on a card when the Edition has no corners', async () => {
    await render(inEdition(<EntryCard card={card} />));

    expect(screen.queryByTestId('card-corner-topLeft', { hidden: true })).toBeNull();
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

      expect(screen.getByTestId('word-lemma')).toHaveTextContent(longestWordOfTheDay.model.lemma);
      expect(screen.getByLabelText('Engineering')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Pronounce' }));
      expect(speak).toHaveBeenCalledTimes(1);
    } finally {
      Dimensions.set({ window });
    }
  });
});

/** The Correction card with its action row and the mark buttons there. */
function correctionWithMarks({
  mark,
  onTap = jest.fn(),
}: {
  mark?: 'known' | 'unknown';
  onTap?: (mark: 'known' | 'unknown') => void;
} = {}) {
  return inEdition(
    <EntryCard
      card={card}
      actions={
        <ActionRow
          marks={<KnowledgeButtons entryKind="correction" mark={mark} onTap={onTap} />}
          favorite={<Text>♡</Text>}
          collection={<Text>+</Text>}
          hide={<Text>×</Text>}
        />
      }
    />,
  );
}

describe('the mark buttons on a Correction card', () => {
  it('marks a Correction with no mark Known', async () => {
    const onTap = jest.fn();
    await render(correctionWithMarks({ onTap }));

    expect(screen.getByRole('button', { name: 'Unknown', selected: false })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Known', selected: false }));

    expect(onTap).toHaveBeenCalledWith('known');
  });

  it('says on Known that the reader already says it right', async () => {
    await render(correctionWithMarks());

    expect(screen.getByHintText('I already say it right')).toBe(
      screen.getByRole('button', { name: 'Known' }),
    );
  });

  it('changes a Known Correction to Unknown', async () => {
    const onTap = jest.fn();
    await render(correctionWithMarks({ mark: 'known', onTap }));

    expect(screen.getByRole('button', { name: 'Known', selected: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Unknown', selected: false }));

    expect(onTap).toHaveBeenCalledWith('unknown');
  });

  it('removes the mark when its button is tapped again', async () => {
    const onTap = jest.fn();
    await render(correctionWithMarks({ mark: 'unknown', onTap }));

    await fireEvent.press(screen.getByRole('button', { name: 'Unknown', selected: true }));

    expect(onTap).toHaveBeenCalledWith('unknown');
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

    expect(screen.getByTestId('word-register-dialectal')).toHaveTextContent('dial., Hutsulshchyna');
    expect(screen.getByLabelText('dialectal, Hutsulshchyna')).toBeTruthy();
  });

  it('shows with the label once the reader reveals a Self-check card', async () => {
    await render(inEdition(<EntryCard card={dialectWord} selfCheck />));
    expect(screen.queryByTestId('word-register-dialectal')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));

    expect(screen.getByTestId('word-register-dialectal')).toHaveTextContent('dial., Hutsulshchyna');
    expect(screen.getByLabelText('dialectal, Hutsulshchyna')).toBeTruthy();
  });
});

describe('Self-check on a Word card', () => {
  it('shows only the Lemma, part of speech and Category until revealed', async () => {
    await render(inEdition(<EntryCard card={wordWithEverything} selfCheck />));

    expect(screen.getByTestId('word-lemma')).toHaveTextContent('lemma');
    expect(screen.getByTestId('word-part-of-speech')).toHaveTextContent('n.');
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
    expect(screen.getByTestId('word-example')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show the meaning' })).toBeNull();
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
    expect(screen.getByText('take part')).toBeTruthy();
    expect(screen.getByText('How to say it?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show' })).toBeTruthy();
    for (const concealedPart of [
      'correction-type',
      'correction-standard',
      'correction-other-equivalents',
      'correction-explanation',
      'correction-example-pair',
      'correction-source',
    ]) {
      expect(screen.queryByTestId(concealedPart)).toBeNull();
    }
    expect(screen.queryByText('join in')).toBeNull();
  });

  it('shows the right form and the explanation once the reader taps «Show»', async () => {
    await render(inEdition(<EntryCard card={correctionWithEverything()} selfCheck />));

    await fireEvent.press(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByTestId('correction-standard')).toBeTruthy();
    expect(screen.getByTestId('correction-explanation')).toHaveTextContent('A long explanation.');
    expect(screen.getByTestId('correction-example-pair')).toBeTruthy();
    expect(screen.queryByText('How to say it?')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show' })).toBeNull();
  });
});

describe('VoiceOver on a stress trap', () => {
  it('says where the Stress of each form falls on the card', async () => {
    await render(inEdition(<EntryCard card={stressTrap} />));

    expect(screen.getByTestId('correction-non-standard')).toHaveProp(
      'accessibilityLabel',
      'Non-standard: catalog, stress on a',
    );
    expect(screen.getByTestId('correction-standard')).toHaveProp(
      'accessibilityLabel',
      'Standard: catalog, stress on o',
    );
  });

  it('reads the explanation and the example pair without the Stress mark', async () => {
    await render(inEdition(<EntryCard card={stressTrap} />));

    expect(screen.getByTestId('correction-explanation')).toHaveProp(
      'accessibilityLabel',
      'Say catalog, as in dialog.',
    );
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

    expect(screen.getByLabelText('Non-standard: take part')).toBeTruthy();
    expect(screen.getByLabelText('Standard: join in')).toBeTruthy();
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
    sourceTitles: ['A phrase dictionary'],
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
  sourceTitles: [],
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
  sourceTitles: ['A book of proverbs'],
});

describe('the Idiom card', () => {
  it('shows the expression, its chip, Definitions, Examples, «Origin» and sources of an idiom', async () => {
    await render(
      inEdition(<EntryCard card={{ kind: 'idiom', entryId: 'i1', model: idiomCard() }} />),
    );

    expect(screen.getByTestId('idiom-expression')).toHaveTextContent('to beat the bushes');
    expect(screen.getByTestId('idiom-type')).toHaveTextContent('idiom');
    expect(screen.getByTestId('idiom-definition')).toHaveTextContent('To idle about.');
    expect(screen.getByTestId('idiom-extra-definitions')).toHaveTextContent(
      'Other meanings2. To search everywhere.',
    );
    expect(screen.getAllByTestId('idiom-example')).toHaveLength(2);
    expect(screen.getByText('He beat the bushes all day.')).toBeTruthy();
    expect(screen.getByText('Stop beating the bushes.')).toBeTruthy();
    expect(screen.getByTestId('idiom-etymology')).toHaveTextContent('OriginFrom the hunt.');
    expect(screen.getByTestId('idiom-source')).toHaveTextContent('Source: A phrase dictionary');
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
    expect(screen.getByText('They drove to Berdychiv.')).toBeTruthy();
    expect(screen.getByTestId('idiom-etymology')).toHaveTextContent(
      'OriginNamed after the Berdy tribe.',
    );
    expect(screen.queryByTestId('idiom-extra-definitions')).toBeNull();
    expect(screen.queryByTestId('idiom-source')).toBeNull();
  });

  it('shows the chip «proverb» on a proverb card', async () => {
    await render(inEdition(<EntryCard card={{ kind: 'idiom', entryId: 'i3', model: proverb }} />));

    expect(screen.getByTestId('idiom-expression')).toHaveTextContent(
      'the early bird catches the worm',
    );
    expect(screen.getByTestId('idiom-type')).toHaveTextContent('proverb');
    expect(screen.getByTestId('idiom-definition')).toHaveTextContent('Who starts early, wins.');
    expect(screen.queryByTestId('idiom-etymology')).toBeNull();
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
    for (const concealedPart of ['idiom-definition', 'idiom-example', 'idiom-etymology']) {
      expect(screen.queryByTestId(concealedPart)).toBeNull();
    }

    await fireEvent.press(screen.getByRole('button', { name: 'Show the meaning' }));

    expect(screen.getByTestId('idiom-definition')).toHaveTextContent('To idle about.');
    expect(screen.getByTestId('idiom-etymology')).toBeTruthy();
  });
});
