import type { Example, Gender, PartOfSpeech, Register, Word } from '@slovo/contracts';

import type { Entries } from './entries';
import { renderStress, stressedVowelsOf } from './stress';
import { buildSynonymRowCard, type SynonymRowWordModel } from './synonym-row-card';

/** A Correction the Word is the standard form for, as its card links it. */
export interface LinkedCorrection {
  readonly correctionId: string;
  /** The non-standard form people commonly use. */
  readonly nonStandardForm: string;
}

/**
 * The Synonym Row a Word card links back to, shown as «У синонімічному ряду:
 * {домінанта}» and opened on a tap (ADR 0051).
 */
export interface WordCardSynonymRow {
  readonly synonymRowId: string;
  /** The row's dominant, linked to its Word as the row's card links it. */
  readonly dominant: SynonymRowWordModel;
}

/** What "more" opens on a Word card. Each list holds at least one item when present. */
export interface WordCardDetails {
  readonly etymology: string | undefined;
  /** The Definitions after the primary one. */
  readonly extraDefinitions: readonly string[];
  /** The Examples after the first one. */
  readonly examples: readonly Example[];
}

/**
 * What a Word card shows, decided by the Core: the UI draws it and never
 * picks sections itself. It carries data and keys only; the UI turns the keys
 * (part of speech, gender, registers) into the Edition's strings.
 * A section without data is left out: `undefined` or an empty list.
 */
export interface WordCardModel {
  readonly kind: 'word';
  readonly wordId: string;
  /** The Lemma with every Stress mark applied. */
  readonly lemma: string;
  /**
   * The stressed vowels of the Lemma, in order: one per valid Stress. Empty in
   * an Edition that doesn't mark Stress.
   */
  readonly stressedVowels: readonly string[];
  readonly partOfSpeech: PartOfSpeech;
  readonly gender: Gender | undefined;
  readonly primaryDefinition: string;
  /** The first Example, with its author only when the source names one. */
  readonly example: Example | undefined;
  readonly synonyms: readonly string[];
  readonly antonyms: readonly string[];
  readonly registers: readonly Register[];
  /** Where a dialect Word is said, shown after its dialectal register label. */
  readonly region: string | undefined;
  /** How the Word left the language or changed its meaning. */
  readonly history: string | undefined;
  readonly categoryId: string;
  /** The display name of the Word's Category, from the Language Pack; nothing for one the pack doesn't have. */
  readonly categoryName: string | undefined;
  /** Present only when the Word has an etymology, extra Definitions or more Examples. */
  readonly details: WordCardDetails | undefined;
  readonly linkedCorrections: readonly LinkedCorrection[];
  /** The first live Synonym Row that links the Word as a member; nothing for a Word in no row. */
  readonly synonymRow: WordCardSynonymRow | undefined;
}

/** The most Synonyms a Word card shows. */
const MAX_SYNONYMS = 3;

/**
 * The Word card of a Word, linking the Corrections and the Synonym Row and
 * naming the Category the Entries give for it.
 */
export async function buildWordCard({
  word,
  entries,
}: {
  word: Word;
  entries: Pick<Entries, 'linkedCorrections' | 'categories' | 'linkingSynonymRow' | 'getMany'>;
}): Promise<WordCardModel> {
  const [linked, categories, synonymRow] = await Promise.all([
    entries.linkedCorrections(word),
    entries.categories(),
    linkedSynonymRow(word, entries),
  ]);
  return {
    kind: 'word',
    wordId: word.id,
    lemma: renderStress(word),
    stressedVowels: stressedVowelsOf(word),
    partOfSpeech: word.partOfSpeech,
    gender: word.gender,
    primaryDefinition: word.primaryDefinition,
    example: word.examples[0],
    synonyms: word.synonyms.slice(0, MAX_SYNONYMS),
    antonyms: word.antonyms,
    registers: word.registers,
    region: word.region,
    history: word.history,
    categoryId: word.categoryId,
    categoryName: categories.find(({ id }) => id === word.categoryId)?.displayName,
    details: detailsOf(word),
    linkedCorrections: linked.map(({ id, nonStandardForm }) => ({
      correctionId: id,
      nonStandardForm,
    })),
    synonymRow,
  };
}

/** The back-link to the Synonym Row that links the Word, its dominant linked by the row card's rule. */
async function linkedSynonymRow(
  word: Word,
  entries: Pick<Entries, 'linkingSynonymRow' | 'getMany'>,
): Promise<WordCardSynonymRow | undefined> {
  const synonymRow = await entries.linkingSynonymRow(word);
  if (synonymRow === undefined) return undefined;
  const { synonymRowId, dominant } = await buildSynonymRowCard({ synonymRow, entries });
  return { synonymRowId, dominant };
}

/** What "more" opens, or nothing when the card already shows all the Word has. */
function detailsOf({ etymology, extraDefinitions, examples }: Word): WordCardDetails | undefined {
  const moreExamples = examples.slice(1);
  if (etymology === undefined && extraDefinitions.length === 0 && moreExamples.length === 0) {
    return undefined;
  }
  return { etymology, extraDefinitions, examples: moreExamples };
}
