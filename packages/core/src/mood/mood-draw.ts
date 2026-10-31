import type { Mood, Word } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import type { Random } from '../ports';

/** How many Lemmas the roulette runs through, the last the Word it lands on. */
const ROULETTE_LENGTH = 12;

/** Why a mood is disabled: none of its Words is Eligible. */
export type MoodRefusal = 'no-eligible-word';

/** A mood on offer, with why it is disabled, if it is. */
export interface MoodChoice {
  readonly mood: Mood;
  readonly refusal: MoodRefusal | undefined;
}

/** A mood's roulette: the Lemmas it runs through and the Word it lands on. */
export interface MoodRoulette {
  /** The Word it lands on, which the shell opens with `openedFromMood`. */
  readonly wordId: string;
  /** The Lemmas of the mood's Eligible Words, never one twice in a row unless the mood has one Word, the last the Word's own. */
  readonly lemmas: readonly string[];
}

/**
 * «Слово під настрій» (ADR 0054): a random Eligible Word of a Mood, drawn over
 * the Words the Mix gives (its Categories, its Rarity Floor, not Retired, not
 * Hidden). The Mix and the Hidden Entries are read afresh on every call. It
 * writes nothing, so no Word is Seen.
 */
export interface MoodDraw {
  /** The Edition's moods in its order, each refused when none of its Words is Eligible; none while the Edition turns moods off. */
  moods(): Promise<readonly MoodChoice[]>;
  /** A new roulette for the mood; nothing for a mood with no Eligible Word, an unknown mood or while the Edition turns moods off. */
  draw(moodId: string): Promise<MoodRoulette | undefined>;
}

export function createMoodDraw({
  edition,
  entries,
  random,
}: {
  edition: Pick<Edition, 'isFeatureEnabled' | 'moods'>;
  /** The composition's Entries, shared with the Feed and the Rarity Test, so the Words are read once. */
  entries: Pick<Entries, 'eligibleOfKind'>;
  random: Random;
}): MoodDraw {
  const isOn = () => edition.isFeatureEnabled('moods');
  /** A random Word of the list; nothing of an empty one. */
  const pick = (words: readonly Word[]) => words[Math.floor(random.next() * words.length)];

  /** The Eligible Words, in the order the Entries give them. */
  async function eligibleWords(): Promise<readonly Word[]> {
    const eligible = await entries.eligibleOfKind('word');
    return 'entries' in eligible
      ? eligible.entries.filter((entry): entry is Word => entry.kind === 'word')
      : [];
  }
  const ofMood = (words: readonly Word[], moodId: string) =>
    words.filter((word) => word.moods?.includes(moodId) === true);

  return {
    async moods() {
      if (!isOn()) return [];
      const words = await eligibleWords();
      return edition.moods.map((mood) => ({
        mood,
        refusal: ofMood(words, mood.id).length === 0 ? 'no-eligible-word' : undefined,
      }));
    },
    async draw(moodId) {
      if (!isOn() || !edition.moods.some((mood) => mood.id === moodId)) return undefined;
      const words = ofMood(await eligibleWords(), moodId);
      const landing = pick(words);
      if (landing === undefined) return undefined;
      // Back from the landing Word, each Lemma another than the one after it.
      const lemmas = [landing.lemma];
      while (lemmas.length < ROULETTE_LENGTH) {
        const after = lemmas[0];
        lemmas.unshift((pick(words.filter((word) => word.lemma !== after)) ?? landing).lemma);
      }
      return { wordId: landing.id, lemmas };
    },
  };
}
