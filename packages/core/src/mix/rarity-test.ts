import { RARITIES, type Rarity } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import type { Mix } from '../entries/mix';
import { renderStress, stressedVowelsOf } from '../entries/stress';
import { shuffled } from '../shuffled';
import type { Random } from '../ports';

/** How many Words of each rarity the Rarity Test asks about. */
const WORDS_PER_RARITY = 2;

/** A Word the Rarity Test asks about: only its Lemma with Stress is shown. */
export interface RarityTestWord {
  readonly wordId: string;
  readonly rarity: Rarity;
  /** The Lemma with Stress, as the Word card shows it. */
  readonly lemmaWithStress: string;
  /** The stressed vowels of the Lemma, in order, as VoiceOver names them. */
  readonly stressedVowels: readonly string[];
}

/** The reader's answer on a drawn Word: «Знаю» (`known`) or «Не знаю». */
export interface RarityTestAnswer {
  readonly rarity: Rarity;
  readonly known: boolean;
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
  /**
   * Sets the Rarity Floor by the answers, at once, and resolves to it: the
   * lowest rarity with «Не знаю», or 5 when every Word is known. A retake
   * overwrites the floor. It sets no Knowledge Mark, starts no Review and
   * makes nothing Seen. Nothing is set, and it resolves to nothing, for no
   * answers or while the Edition turns the Rarity Test or the Rarity Floor
   * off (or a remote switch does).
   */
  apply(answers: readonly RarityTestAnswer[]): Promise<Rarity | undefined>;
}

export function createRarityTest({
  edition,
  entries,
  mix,
  random,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  entries: Pick<Entries, 'eligibleWordsOfAnyRarity'>;
  mix: Pick<Mix, 'setRarityFloor'>;
  random: Random;
}): RarityTest {
  const isOn = () =>
    edition.isFeatureEnabled('rarityTest') && edition.isFeatureEnabled('rarityFloor');
  return {
    async draw() {
      if (!isOn()) return [];
      const words = await entries.eligibleWordsOfAnyRarity();
      return RARITIES.flatMap((rarity) =>
        shuffled(
          words.filter((word) => word.rarity === rarity),
          random,
        )
          .slice(0, WORDS_PER_RARITY)
          .map((word) => ({
            wordId: word.id,
            rarity,
            lemmaWithStress: renderStress(word),
            stressedVowels: stressedVowelsOf(word),
          })),
      );
    },
    async apply(answers) {
      if (!isOn() || answers.length === 0) return undefined;
      const unknown = answers.filter((answer) => !answer.known).map((answer) => answer.rarity);
      const floor = RARITIES.find((rarity) => unknown.includes(rarity)) ?? 5;
      await mix.setRarityFloor(floor);
      return floor;
    },
  };
}
