import type { Correction, Example, Gender, PartOfSpeech, Register, Word } from '@slovo/contracts';

import type { ContentReadPort } from './ports';
import { renderStress } from './stress';

/** A Correction the Word is the standard form for, as its card links it. */
export interface LinkedCorrection {
  readonly correctionId: string;
  /** The non-standard form people commonly use. */
  readonly nonStandardForm: string;
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
 * (part of speech, gender, registers, Category) into the Edition's strings.
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
  readonly categoryId: string;
  /** Present only when the Word has an etymology, extra Definitions or more Examples. */
  readonly details: WordCardDetails | undefined;
  readonly linkedCorrections: readonly LinkedCorrection[];
}

/** The most Synonyms a Word card shows. */
export const MAX_SYNONYMS = 3;

/** The Word card of a Word. */
export async function buildWordCard({
  word,
  content,
}: {
  word: Word;
  content: ContentReadPort;
}): Promise<WordCardModel> {
  return {
    kind: 'word',
    wordId: word.id,
    lemma: renderStress(word),
    stressedVowels: word.stress.flatMap((position) => Array.from(word.lemma)[position] ?? []),
    partOfSpeech: word.partOfSpeech,
    gender: word.gender,
    primaryDefinition: word.primaryDefinition,
    example: word.examples[0],
    synonyms: word.synonyms.slice(0, MAX_SYNONYMS),
    antonyms: word.antonyms,
    registers: word.registers,
    categoryId: word.categoryId,
    details: detailsOf(word),
    linkedCorrections: await linkedCorrectionsOf(word, content),
  };
}

/**
 * The Corrections the Word links, in its order. A Retired Correction is no
 * longer linked from Words, and one missing from the Language Pack is skipped.
 */
async function linkedCorrectionsOf(
  word: Word,
  content: ContentReadPort,
): Promise<LinkedCorrection[]> {
  const corrections = await Promise.all(word.correctionIds.map((id) => content.getCorrection(id)));
  return corrections
    .filter((correction): correction is Correction => correction?.retired === false)
    .map(({ id, nonStandardForm }) => ({ correctionId: id, nonStandardForm }));
}

/** What "more" opens, or nothing when the card already shows all the Word has. */
function detailsOf({ etymology, extraDefinitions, examples }: Word): WordCardDetails | undefined {
  const moreExamples = examples.slice(1);
  if (etymology === undefined && extraDefinitions.length === 0 && moreExamples.length === 0) {
    return undefined;
  }
  return { etymology, extraDefinitions, examples: moreExamples };
}
