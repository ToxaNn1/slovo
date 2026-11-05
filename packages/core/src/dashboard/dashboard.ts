import type { Mood } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { renderStress, stressedVowelsOf } from '../entries/stress';
import type { Cycle } from '../feed/cycle';
import type { Feed } from '../feed/feed';
import type { WordOfTheDay } from '../feed/word-of-the-day';
import { dateKeyOf, todayDate, type LocalDate } from '../local-date';
import type { Clock } from '../ports';
import { createSubscribers } from '../in-turn';
import type { MoodCheckIns } from '../mood/mood';
import type { WordOfTheDayArchive, WordOfTheDayArchiveDay } from '../saved/word-of-the-day-archive';
import type { CorrectionTypeTile, CorrectionTypes } from './correction-types';
import type { CuratedCollectionCard, CuratedCollections } from './curated-collections';

/** How many archive days «Попередні слова» shows at most. */
const PREVIOUS_WORDS = 3;

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
export type DashboardBlock =
  | WordOfTheDayBlock
  | MoodBlock
  | PreviousWordsBlock
  | CorrectionTypesBlock
  | CuratedCollectionsBlock;

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
 * «Попередні слова», after the Mood check-in: the three newest days of the
 * Word of the Day archive before today, newest first. A Retired Word stays;
 * with no such day there is no block (ADR 0076). A tap opens the Entry card
 * as Search does, making nothing Seen.
 */
export interface PreviousWordsBlock {
  readonly kind: 'previousWords';
  /** One to three days, newest first. */
  readonly days: readonly WordOfTheDayArchiveDay[];
}

/**
 * The Correction Types rail's block, after Mood: a tile per Correction Type
 * with live Corrections, with N and X «розібрано». No tile, no block.
 */
export interface CorrectionTypesBlock {
  readonly kind: 'correctionTypes';
  readonly tiles: readonly CorrectionTypeTile[];
}

/**
 * The Curated Collections rail's block, «Добірки», after the Correction
 * Types: the collections published by today, the unopened first. No card,
 * no block.
 */
export interface CuratedCollectionsBlock {
  readonly kind: 'curatedCollections';
  readonly cards: readonly CuratedCollectionCard[];
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
  archive,
  clock,
  correctionTypes,
  curatedCollections,
  seen,
  dayTurned,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  entries: Entries;
  cycle: Pick<Cycle, 'covers' | 'unseen'>;
  wordOfTheDay: Pick<WordOfTheDay, 'today'>;
  feed: Pick<Feed, 'seeWordOfTheDay'>;
  mood: Pick<MoodCheckIns, 'today' | 'moods' | 'subscribe'>;
  archive: Pick<WordOfTheDayArchive, 'list'>;
  /** Tells today, whose archive day is the hero's. */
  clock: Clock;
  correctionTypes: Pick<CorrectionTypes, 'tiles' | 'subscribe'>;
  curatedCollections: Pick<CuratedCollections, 'rail' | 'subscribe'>;
  seen: { subscribe(listener: (entryId: string) => unknown): unknown };
  dayTurned: { subscribe(listener: (day: LocalDate) => unknown): unknown };
}): Promise<Dashboard> {
  const subscribers = createSubscribers();
  const on = edition.isFeatureEnabled('dashboard');
  const moodOn = edition.isFeatureEnabled('mood');
  const previousWordsOn = edition.isFeatureEnabled('previousWords');

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

  async function previousWords(): Promise<PreviousWordsBlock | undefined> {
    // Today's day is the hero's, so it is left out.
    const todayKey = dateKeyOf(todayDate(clock));
    const days = (await archive.list())
      .filter(({ date }) => dateKeyOf(date) < todayKey)
      .slice(0, PREVIOUS_WORDS);
    return days.length === 0 ? undefined : { kind: 'previousWords', days };
  }

  async function blocksOf(): Promise<readonly DashboardBlock[]> {
    if (!on) return [];
    const blocks: DashboardBlock[] = [];
    const wordOfTheDayHero = await hero();
    if (wordOfTheDayHero !== undefined)
      blocks.push({ kind: 'wordOfTheDay', hero: wordOfTheDayHero });
    const moodCheckIn = moodBlock();
    if (moodCheckIn !== undefined) blocks.push(moodCheckIn);
    const previous = previousWordsOn ? await previousWords() : undefined;
    if (previous !== undefined) blocks.push(previous);
    const { tiles } = correctionTypes;
    if (tiles.length > 0) blocks.push({ kind: 'correctionTypes', tiles });
    const { rail } = curatedCollections;
    if (rail.length > 0) blocks.push({ kind: 'curatedCollections', cards: rail });
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
    correctionTypes.subscribe(() => void refresh());
    curatedCollections.subscribe(() => void refresh());
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
    case 'previousWords':
      return `previousWords:${block.days
        .map(({ date, row }) => `${dateKeyOf(date)}=${row.entryId}`)
        .join(',')}`;
    case 'correctionTypes':
      return `correctionTypes:${block.tiles
        .map(
          ({ type, total, workedThrough }) => `${type}=${String(workedThrough)}/${String(total)}`,
        )
        .join(',')}`;
    case 'curatedCollections':
      return `curatedCollections:${block.cards
        .map(({ collection: { id }, state }) => `${id}=${state}`)
        .join(',')}`;
  }
}
