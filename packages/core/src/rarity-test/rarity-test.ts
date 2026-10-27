import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { renderStress } from '../entries/stress';
import { shuffled } from '../game/game-mode';
import type { Random } from '../ports';

/** The rarities of Words, the commonest first. */
const RARITIES = [1, 2, 3, 4, 5] as const;

/** How many Words of each rarity the Rarity Test asks about. */
const WORDS_PER_RARITY = 2;

/** A Word the Rarity Test asks about: only its Lemma with Stress is shown. */
export interface RarityTestWord {
  readonly wordId: string;
  readonly rarity: number;
  /** The Lemma with Stress, as the Word card shows it. */
  readonly lemmaWithStress: string;
}

/** The Rarity Test (ADR 0054): «Перевірка рівня», which sets the Rarity Floor. */
export interface RarityTest {
  /**
   * Draws the Words to ask about: 2 of each rarity, the commonest first, from
   * the Words eligible but for the Rarity Floor (not Retired, not Hidden, of a
   * Category in the Mix), or every one of a rarity that has fewer. None while
   * the Edition turns the Rarity Test or the Rarity Floor it sets off (or a
   * remote switch does). Each draw is new; it writes nothing, so no Word is Seen.
   */
  draw(): Promise<readonly RarityTestWord[]>;
}

export function createRarityTest({
  edition,
  entries,
  random,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  entries: Pick<Entries, 'eligibleWordsOfAnyRarity'>;
  random: Random;
}): RarityTest {
  return {
    async draw() {
      if (!edition.isFeatureEnabled('rarityTest') || !edition.isFeatureEnabled('rarityFloor')) {
        return [];
      }
      const words = await entries.eligibleWordsOfAnyRarity();
      return RARITIES.flatMap((rarity) =>
        shuffled(
          words.filter((word) => word.rarity === rarity),
          random,
        )
          .slice(0, WORDS_PER_RARITY)
          .map((word) => ({ wordId: word.id, rarity, lemmaWithStress: renderStress(word) })),
      );
    },
  };
}
