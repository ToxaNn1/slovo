import {
  stressLabel,
  type RarityTestAnswer,
  type RarityTestResult,
  type RarityTestWord,
} from '@slovo/core';
import type { RarityTestQuestion } from '@slovo/ui';
import { useCallback } from 'react';

import { useComposition } from '../composition';
import { keep } from '../keep';
import { editionStrings } from '../edition/edition';

/** A drawn Word as the Rarity Test asks about it: its Lemma with Stress, and what VoiceOver reads for it. */
export function rarityTestQuestionOf({
  rarity,
  lemmaWithStress,
  stressedVowels,
}: RarityTestWord): RarityTestQuestion {
  return {
    rarity,
    lemma: lemmaWithStress,
    accessibilityLabel: stressLabel(editionStrings.wordCard, lemmaWithStress, stressedVowels),
  };
}

/**
 * Applies the Rarity Test's answers, in onboarding and from Settings, and
 * resolves to the top of the Rarity Range they set, with how many Words the reader
 * knew. A range that can't be set is
 * logged and leaves the one in force: it resolves to nothing and never rejects.
 */
export function useApplyRarityTest(): (
  answers: readonly RarityTestAnswer[],
) => Promise<RarityTestResult | undefined> {
  const { rarityTest } = useComposition();
  return useCallback(
    (answers) => keep('the Rarity Range', rarityTest.apply(answers)),
    [rarityTest],
  );
}
