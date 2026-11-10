import { RecordingKindSchema, renderStress, type RecordingKind, type Word } from '@slovo/contracts';

/**
 * What a Recording of each Recording Kind reads: `plain` is the Lemma in its
 * first Stress (ADR 0083). The Recordings job makes one Recording per Kind
 * in the contract.
 */
export const RECORDING_TEXTS: Record<
  RecordingKind,
  (word: Pick<Word, 'lemma' | 'stress'>) => string
> = {
  plain: ({ lemma, stress }) => renderStress({ lemma, stress: stress.slice(0, 1) }),
};

/** Every Recording Kind, in the contract's order. */
export const RECORDING_KINDS: readonly RecordingKind[] = RecordingKindSchema.options;
