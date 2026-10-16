import type { Correction, CorrectionType, ExamplePair } from '@slovo/contracts';

/**
 * What a Correction card shows, decided by the Core: the UI draws it and
 * never picks sections itself. It carries data and keys only; the UI turns
 * the Correction Type key into the Edition's string. A Correction carries no
 * Stress, so its texts show as written.
 */
export interface CorrectionCardModel {
  readonly kind: 'correction';
  readonly correctionId: string;
  /** The non-standard form people commonly use. */
  readonly nonStandardForm: string;
  /** The standard equivalent the card puts first. */
  readonly mainEquivalent: string;
  /** The other standard equivalents, in their order; empty when there is one. */
  readonly otherEquivalents: readonly string[];
  readonly correctionType: CorrectionType;
  readonly explanation: string;
  readonly examplePair: ExamplePair;
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
    mainEquivalent,
    otherEquivalents,
    correctionType: correction.correctionType,
    explanation: correction.explanation,
    examplePair: correction.examplePair,
  };
}
