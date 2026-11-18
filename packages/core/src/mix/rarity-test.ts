import { RARITIES, type Rarity } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { renderStress, stressedVowelsOf } from '../entries/stress';
import { shuffled } from '../shuffled';
import type { Random } from '../ports';
import { LOWEST_RARITY, type RarityRangeSetting } from '../entries/rarity-range';

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

/**
 * What the Rarity Test's answers came to: the top of the Rarity Range they
 * set, from 1, whether that changed the range, and how many Words the reader knew.
 */
export interface RarityTestResult {
  /** The top of the Rarity Range set, «від 1 до `top`». */
  readonly top: Rarity;
  /** Whether the Rarity Range in force is another than before the test. */
  readonly changed: boolean;
  /** How many of the Words asked about were answered «Знаю». */
  readonly known: number;
  /** How many Words were asked about. */
  readonly total: number;
}

/** The Rarity Test (ADR 0054, 0156, 0182): «Перевірка рівня», which sets the Rarity Range. */
export interface RarityTest {
  /**
   * Draws the Words to ask about: 2 of each rarity, the commonest first, from
   * the Words eligible but for the Rarity Range (not Retired, not Hidden, of
   * a Category in the Mix), or every one of a rarity that has fewer. None
   * while the Edition turns the Rarity Test or the Rarity Range it sets off
   * (or a remote switch does). Each draw is new; it writes nothing, so no Word is Seen.
   */
  draw(): Promise<readonly RarityTestWord[]>;
  /**
   * Sets the Rarity Range by the answers, at once, from 1 to its top, and
   * resolves to the top (the highest rarity of which the reader knew at
   * least half of the Words asked, or 1 when there is none), whether the
   * range changed, and how many of the Words the reader knew. A retake
   * overwrites the range. It sets no Knowledge Mark, starts no Review and
   * makes nothing Seen. Nothing is set, and it resolves to nothing, for no
   * answers or while the Edition turns the Rarity Test or the Rarity Range
   * off (or a remote switch does).
   */
  apply(answers: readonly RarityTestAnswer[]): Promise<RarityTestResult | undefined>;
}

export function createRarityTest({
  edition,
  entries,
  rarityRange,
  random,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  entries: Pick<Entries, 'eligibleWordsOfAnyRarity'>;
  rarityRange: Pick<RarityRangeSetting, 'set' | 'state'>;
  random: Random;
}): RarityTest {
  const isOn = () => edition.isFeatureEnabled('rarityTest');
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
      const knowsHalf = (rarity: Rarity): boolean => {
        const asked = answers.filter((answer) => answer.rarity === rarity);
        const known = asked.filter((answer) => answer.known).length;
        return asked.length > 0 && known * 2 >= asked.length;
      };
      const top = RARITIES.findLast(knowsHalf) ?? LOWEST_RARITY;
      const before = rarityRange.state;
      await rarityRange.set({ from: LOWEST_RARITY, to: top });
      const { from, to } = rarityRange.state;
      return {
        top,
        changed: from !== before.from || to !== before.to,
        known: answers.filter((answer) => answer.known).length,
        total: answers.length,
      };
    },
  };
}
