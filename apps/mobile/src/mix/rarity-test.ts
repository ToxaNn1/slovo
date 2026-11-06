import type { Rarity } from '@slovo/contracts';
import { stressLabel, type RarityTestAnswer, type RarityTestWord } from '@slovo/core';
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
 * resolves to the Rarity Ceiling they set. A ceiling that can't be set is
 * logged and leaves the one in force: it resolves to nothing and never rejects.
 */
export function useApplyRarityTest(): (
  answers: readonly RarityTestAnswer[],
) => Promise<Rarity | undefined> {
  const { rarityTest } = useComposition();
  return useCallback(
    (answers) => keep('the Rarity Ceiling', rarityTest.apply(answers)),
    [rarityTest],
  );
}
