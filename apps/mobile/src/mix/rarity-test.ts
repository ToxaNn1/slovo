import type { Rarity } from '@slovo/contracts';
import { stressLabel, type RarityTestAnswer, type RarityTestWord } from '@slovo/core';
import type { RarityTestQuestion } from '@slovo/ui';
import { useCallback } from 'react';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
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
 * resolves to the Rarity Floor they set. A floor that can't be set is logged
 * and leaves the one the Mix has: it resolves to nothing and never rejects.
 */
export function useApplyRarityTest(): (
  answers: readonly RarityTestAnswer[],
) => Promise<Rarity | undefined> {
  const { rarityTest } = useComposition();
  return useCallback(
    (answers) =>
      rarityTest.apply(answers).catch((error: unknown) => {
        logError('Could not set the Rarity Floor', error);
        return undefined;
      }),
    [rarityTest],
  );
}
