import { RARITIES, type Rarity } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { renderStress, stressedVowelsOf } from '../entries/stress';
import { shuffled } from '../shuffled';
import type { Random } from '../ports';
import type { RarityCeiling } from '../settings/rarity-ceiling';

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

/** The Rarity Test (ADR 0054, 0072): «Перевірка рівня», which sets the Rarity Ceiling. */
export interface RarityTest {
  /**
   * Draws the Words to ask about: 2 of each rarity, the commonest first, from
   * the Words eligible but for the Rarity Ceiling (not Retired, not Hidden, of
   * a Category in the Mix), or every one of a rarity that has fewer. None
   * while the Edition turns the Rarity Test or the Rarity Ceiling it sets off
   * (or a remote switch does). Each draw is new; it writes nothing, so no Word is Seen.
   */
  draw(): Promise<readonly RarityTestWord[]>;
  /**
   * Sets the Rarity Ceiling by the answers, at once, and resolves to it: the
   * lowest rarity with «Не знаю», or 5 when every Word is known. A retake
   * overwrites the ceiling. It sets no Knowledge Mark, starts no Review and
   * makes nothing Seen. Nothing is set, and it resolves to nothing, for no
   * answers or while the Edition turns the Rarity Test or the Rarity Ceiling
   * off (or a remote switch does).
   */
  apply(answers: readonly RarityTestAnswer[]): Promise<Rarity | undefined>;
}

export function createRarityTest({
  edition,
  entries,
  rarityCeiling,
  random,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  entries: Pick<Entries, 'eligibleWordsOfAnyRarity'>;
  rarityCeiling: Pick<RarityCeiling, 'set'>;
  random: Random;
}): RarityTest {
  const isOn = () =>
    edition.isFeatureEnabled('rarityTest') && edition.isFeatureEnabled('rarityCeiling');
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
      const ceiling = RARITIES.find((rarity) => unknown.includes(rarity)) ?? 5;
      await rarityCeiling.set(ceiling);
      return ceiling;
    },
  };
}
