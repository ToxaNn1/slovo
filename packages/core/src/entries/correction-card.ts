import {
  parseStandardExample,
  type Correction,
  type CorrectionType,
  type ExamplePair,
  type ExampleSegment,
  type LiteraryUse,
} from '@slovo/contracts';

import type { Entries } from './entries';
import { sourceNamesOf } from './source-names';
import { markedStressedVowelsOf } from './stress';

/**
 * What a Correction card shows, decided by the Core: the UI draws it and
 * never picks sections itself. It carries data and keys only; the UI turns
 * the Correction Type key into the Edition's string. A Correction's texts
 * show as written; a wrong-stress Correction writes its Stress marks into
 * them (ADR 0045).
 */
export interface CorrectionCardModel {
  readonly kind: 'correction';
  readonly correctionId: string;
  /** The non-standard form people commonly use. */
  readonly nonStandardForm: string;
  /**
   * The stressed vowels of the non-standard form, found from its marks, as
   * VoiceOver names them; empty for a Correction Type other than a stress trap.
   */
  readonly nonStandardStressedVowels: readonly string[];
  /** The standard equivalent the card puts first. */
  readonly mainEquivalent: string;
  /** The stressed vowels of the main standard equivalent, as for the non-standard form. */
  readonly mainEquivalentStressedVowels: readonly string[];
  /** The other standard equivalents, in their order; empty when there is one. */
  readonly otherEquivalents: readonly string[];
  readonly correctionType: CorrectionType;
  readonly categoryId: string;
  /** The display name of the Correction's Category, from the Language Pack; nothing for one the pack doesn't have. */
  readonly categoryName: string | undefined;
  readonly explanation: string;
  readonly examplePair: CorrectionCardExamplePair;
  /** The names of the Correction's sources, in their order: each one's short name, or its title without one; the card names them in a line. */
  readonly sourceNames: readonly string[];
  /** Real uses of the standard form in literature, in their order; empty when there are none. */
  readonly literaryUses: readonly LiteraryUse[];
}

/**
 * The example pair as the card shows it: the non-standard sentence, and the
 * standard one both as plain text (for VoiceOver and sharing) and in pieces,
 * its standard form apart for the card to draw bold (ADR 0117).
 */
export interface CorrectionCardExamplePair {
  readonly nonStandard: string;
  /** The standard sentence without the marks around its standard form. */
  readonly standard: string;
  /** The standard sentence in order: its text, and its standard form drawn bold. */
  readonly standardSegments: readonly ExampleSegment[];
}

/**
 * Reads the marked standard form out of the example pair. The content's
 * schema refused broken marks where the Correction entered; a sentence with
 * none still shows, all plain.
 */
function cardExamplePair({ nonStandard, standard }: ExamplePair): CorrectionCardExamplePair {
  const parsed = parseStandardExample(standard);
  const standardSegments: readonly ExampleSegment[] =
    parsed.kind === 'marked' ? parsed.segments : [{ kind: 'text', text: standard }];
  return {
    nonStandard,
    standard: standardSegments.map(({ text }) => text).join(''),
    standardSegments,
  };
}

/** The Correction card of a Correction, naming the Category the Entries give for it. */
export async function buildCorrectionCard({
  correction,
  entries,
}: {
  correction: Correction;
  entries: Pick<Entries, 'correctionCategories'>;
}): Promise<CorrectionCardModel> {
  const [mainEquivalent, ...otherEquivalents] = correction.standardEquivalents;
  const categories = await entries.correctionCategories();
  return {
    kind: 'correction',
    correctionId: correction.id,
    nonStandardForm: correction.nonStandardForm,
    nonStandardStressedVowels: markedStressedVowelsOf(correction.nonStandardForm),
    mainEquivalent,
    mainEquivalentStressedVowels: markedStressedVowelsOf(mainEquivalent),
    otherEquivalents,
    correctionType: correction.correctionType,
    categoryId: correction.categoryId,
    categoryName: categories.find(({ id }) => id === correction.categoryId)?.displayName,
    explanation: correction.explanation,
    examplePair: cardExamplePair(correction.examplePair),
    sourceNames: sourceNamesOf(correction.sources),
    literaryUses: correction.literaryUses,
  };
}
