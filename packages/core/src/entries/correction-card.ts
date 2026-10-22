import type { Correction, CorrectionType, ExamplePair } from '@slovo/contracts';

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
  readonly explanation: string;
  readonly examplePair: ExamplePair;
  /** The titles of the Correction's sources, in their order; the card names them in a line. */
  readonly sourceTitles: readonly string[];
}

/** The Correction card of a Correction. */
export function buildCorrectionCard(correction: Correction): CorrectionCardModel {
  const [mainEquivalent, ...otherEquivalents] = correction.standardEquivalents;
  // The contracts require at least one standard equivalent.
  if (mainEquivalent === undefined) {
    throw new Error(`Correction ${correction.id} has no standard equivalent`);
  }
  return {
    kind: 'correction',
    correctionId: correction.id,
    nonStandardForm: correction.nonStandardForm,
    nonStandardStressedVowels: markedStressedVowelsOf(correction.nonStandardForm),
    mainEquivalent,
    mainEquivalentStressedVowels: markedStressedVowelsOf(mainEquivalent),
    otherEquivalents,
    correctionType: correction.correctionType,
    explanation: correction.explanation,
    examplePair: correction.examplePair,
    sourceTitles: correction.sources.map((source) => source.title),
  };
}
