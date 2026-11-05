import type { Mood } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { renderStress, stressedVowelsOf } from '../entries/stress';
import type { Cycle } from '../feed/cycle';
import type { Feed } from '../feed/feed';
import type { WordOfTheDay } from '../feed/word-of-the-day';
import { dateKeyOf, type LocalDate } from '../local-date';
import { createSubscribers } from '../in-turn';
import type { MoodCheckIns } from '../mood/mood';

/**
 * The Word of the Day hero: unrevealed until «Розкрити», revealed with its
 * Lemma, Stress and short Definition once the Word is Seen in the current
 * Cycle (ADR 0076). Revealed is derived from Seen, never stored.
 */
export type WordOfTheDayHero =
  | { readonly state: 'unrevealed'; readonly wordId: string; readonly date: LocalDate }
  | {
      readonly state: 'revealed';
      readonly wordId: string;
      readonly date: LocalDate;
      /** The Lemma with Stress, as the Word card shows it. */
      readonly lemmaWithStress: string;
      /** The stressed vowels of the Lemma, in order, as VoiceOver names them. */
      readonly stressedVowels: readonly string[];
      /** The short Definition: the Word's primary Definition. */
      readonly definition: string;
    };

/**
 * One block of the Dashboard, in display order. Each kind is its own member
 * of the union, so a later block (previous Words, Mood, the rails) is one
 * more member and one more line in `blocksOf`.
 */
export type DashboardBlock = WordOfTheDayBlock | MoodBlock;

/** The Word of the Day hero's block, first on the Dashboard. */
export interface WordOfTheDayBlock {
  readonly kind: 'wordOfTheDay';
  readonly hero: WordOfTheDayHero;
}

/**
 * The Mood check-in's block, after the hero: asking «Як настрій?» with the
 * four moods, or today's chosen Mood with its reply. A skipped day has no
 * block till tomorrow (ADR 0076).
 */
export interface MoodBlock {
  readonly kind: 'mood';
  /** The four moods to choose from, in display order. */
  readonly moods: readonly Mood[];
  readonly check: { readonly state: 'asking' } | { readonly state: 'chosen'; readonly mood: Mood };
}

/**
 * The Dashboard (ADR 0076): the home's blocks for the local day the
 * composition turned to last. They follow the day change and Seen; with
 * `dashboard` off there are none.
 */
export interface Dashboard {
  /** The blocks in display order. A change makes a new array and tells the subscribers. */
  readonly blocks: readonly DashboardBlock[];
  /** Calls `listener` after each change of the blocks. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
  /** «Розкрити»: makes today's Word of the Day Seen through the Feed's Seen; the hero turns revealed. */
  reveal(): Promise<void>;
}

export async function openDashboard({
  edition,
  entries,
  cycle,
  wordOfTheDay,
  feed,
  mood,
  seen,
  dayTurned,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  entries: Entries;
  cycle: Pick<Cycle, 'covers' | 'unseen'>;
  wordOfTheDay: Pick<WordOfTheDay, 'today'>;
  feed: Pick<Feed, 'seeWordOfTheDay'>;
  mood: Pick<MoodCheckIns, 'today' | 'moods' | 'subscribe'>;
  seen: { subscribe(listener: (entryId: string) => unknown): unknown };
  dayTurned: { subscribe(listener: (day: LocalDate) => unknown): unknown };
}): Promise<Dashboard> {
  const subscribers = createSubscribers();
  const on = edition.isFeatureEnabled('dashboard');
  const moodOn = edition.isFeatureEnabled('mood');

  async function hero(): Promise<WordOfTheDayHero | undefined> {
    const today = await wordOfTheDay.today();
    if (today === undefined) return undefined;
    const { wordId, date } = today;
    const isSeen = cycle.covers(wordId) && !cycle.unseen().words.includes(wordId);
    const word = isSeen ? await entries.get(wordId) : undefined;
    if (word?.kind !== 'word') return { state: 'unrevealed', wordId, date };
    return {
      state: 'revealed',
      wordId,
      date,
      lemmaWithStress: renderStress(word),
      stressedVowels: stressedVowelsOf(word),
      definition: word.primaryDefinition,
    };
  }

  function moodBlock(): MoodBlock | undefined {
    const check = mood.today;
    if (!moodOn || check.state === 'skipped') return undefined;
    return { kind: 'mood', moods: mood.moods, check };
  }

  async function blocksOf(): Promise<readonly DashboardBlock[]> {
    if (!on) return [];
    const blocks: DashboardBlock[] = [];
    const wordOfTheDayHero = await hero();
    if (wordOfTheDayHero !== undefined)
      blocks.push({ kind: 'wordOfTheDay', hero: wordOfTheDayHero });
    const moodCheckIn = moodBlock();
    if (moodCheckIn !== undefined) blocks.push(moodCheckIn);
    return blocks;
  }

  let blocks = await blocksOf();
  let shownKey = keyOf(blocks);
  async function refresh(): Promise<void> {
    const next = await blocksOf();
    const key = keyOf(next);
    if (key === shownKey) return;
    blocks = next;
    shownKey = key;
    subscribers.tell();
  }
  if (on) {
    seen.subscribe(() => refresh());
    dayTurned.subscribe(() => refresh());
    mood.subscribe(() => void refresh());
  }

  return {
    get blocks() {
      return blocks;
    },
    subscribe: subscribers.subscribe,
    async reveal() {
      await feed.seeWordOfTheDay();
      await refresh();
    },
  };
}

/** What a reader sees of the blocks, so an unchanged day tells no one. */
function keyOf(blocks: readonly DashboardBlock[]): string {
  return blocks.map(blockKeyOf).join('|');
}

function blockKeyOf(block: DashboardBlock): string {
  switch (block.kind) {
    case 'wordOfTheDay': {
      const { hero } = block;
      return `${hero.state}:${hero.wordId}:${dateKeyOf(hero.date)}`;
    }
    case 'mood': {
      const { check } = block;
      return check.state === 'chosen' ? `mood:chosen:${check.mood.id}` : 'mood:asking';
    }
  }
}
