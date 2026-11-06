import type { Mood, Rarity } from '@slovo/contracts';

import type { Analytics } from '../analytics/analytics';
import type { Edition } from '../edition/edition';
import type { MixKindWeights } from '../entries/mix';
import { createSubscribers } from '../in-turn';
import { todayKey, type LocalDate } from '../local-date';
import type { Clock } from '../ports';
import type { RarityCeiling } from '../entries/rarity-ceiling';
import type { UserState } from '../user-state/user-state';
import { inRarityBand, shiftedKindWeights } from './feed-parameters';
import { moodRecords } from './records';

/** The choice a skipped day keeps. */
const SKIPPED = 'skipped';

/**
 * Today's Mood check-in (ADR 0076): asking while the local day has no record,
 * chosen with the Mood, or skipped («Не сьогодні»), which hides the block
 * until tomorrow.
 */
export type MoodCheckIn =
  | { readonly state: 'asking' }
  | { readonly state: 'chosen'; readonly mood: Mood }
  | { readonly state: 'skipped' };

/** What today's Mood asks of the Feed (ADR 0076); the Feed as it is without one. */
export interface MoodFeedParameters {
  /**
   * Whether a Word of the rarity is in today's rarity band, clipped to the
   * Rarity Ceiling; nothing when the band is every rarity.
   */
  readonly inBand: ((rarity: Rarity) => boolean) | undefined;
  /** The reader's Mix kind weights shifted by today's Mood. */
  kindWeights(weights: MixKindWeights): MixKindWeights;
}

/**
 * The daily Mood check-in: one record per local day, synced last write wins,
 * which the Dashboard asks, the Feed reads (#1571) and the Profile counts.
 */
export interface MoodCheckIns {
  /** Today's check-in; `asking` with `mood` off, since nothing asks. */
  readonly today: MoodCheckIn;
  /**
   * Today's Mood, or none: a Mood chosen on another local day answers
   * nothing, even before the day change reaches the check-in.
   */
  todaysMood(): Mood | undefined;
  /** What today's Mood asks of the next Feed card, read for each card. */
  feedParameters(): MoodFeedParameters;
  /** The four moods of the Dashboard, in display order. */
  readonly moods: readonly Mood[];
  /** Chooses the mood for today, or changes it; an id not among `moods` is ignored. */
  choose(moodId: string): Promise<void>;
  /** «Не сьогодні»: skips today. */
  skip(): Promise<void>;
  /** The days each Mood was chosen on, by mood id, for the statistics row «Настрої»; skipped days count for none. */
  daysByMood(): Promise<ReadonlyMap<string, number>>;
  /** Calls `listener` after each change of `today`. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

export async function openMoodCheckIns({
  edition,
  userState,
  clock,
  dayTurned,
  analytics,
  rarityCeiling,
}: {
  edition: Pick<Edition, 'isFeatureEnabled' | 'dashboardMoods'>;
  userState: Pick<UserState, 'read' | 'list' | 'write'>;
  clock: Clock;
  dayTurned: { subscribe(listener: (day: LocalDate) => unknown): unknown };
  analytics: Pick<Analytics, 'track'>;
  /** The Rarity Ceiling the Mood's rarity band clips to. */
  rarityCeiling: Pick<RarityCeiling, 'state'>;
}): Promise<MoodCheckIns> {
  const subscribers = createSubscribers();
  const on = edition.isFeatureEnabled('mood');
  const moods = edition.dashboardMoods;
  const moodOf = (id: string) => moods.find((mood) => mood.id === id);

  async function checkInOn(date: string): Promise<MoodCheckIn> {
    if (!on) return { state: 'asking' };
    const record = await userState.read(moodRecords.checkIns.record(date));
    if (record === undefined) return { state: 'asking' };
    if (record.choice === SKIPPED) return { state: 'skipped' };
    const mood = moodOf(record.choice);
    return mood === undefined ? { state: 'asking' } : { state: 'chosen', mood };
  }

  /** The local day `today` was read for. */
  let day = todayKey(clock);
  let today = await checkInOn(day);

  async function refresh(): Promise<void> {
    const date = todayKey(clock);
    const next = await checkInOn(date);
    day = date;
    if (keyOf(next) === keyOf(today)) return;
    today = next;
    subscribers.tell();
  }

  function todaysMood(): Mood | undefined {
    return today.state === 'chosen' && day === todayKey(clock) ? today.mood : undefined;
  }

  async function record(choice: string): Promise<void> {
    if (!on) return;
    const date = todayKey(clock);
    await userState.write(moodRecords.checkIns.record(date).change({ date, choice }));
    await refresh();
  }

  if (on) dayTurned.subscribe(() => refresh());

  return {
    get today() {
      return today;
    },
    todaysMood,
    feedParameters() {
      const mood = todaysMood();
      const band = mood?.rarityBand ?? 'whole';
      return {
        inBand:
          band === 'whole'
            ? undefined
            : (rarity) => inRarityBand(rarity, band, rarityCeiling.state),
        kindWeights: (weights) => shiftedKindWeights(weights, mood),
      };
    },
    moods,
    async choose(moodId) {
      if (moodOf(moodId) === undefined) return;
      await record(moodId);
      await analytics.track('moodChosen', { mood: moodId });
    },
    async skip() {
      await record(SKIPPED);
      await analytics.track('moodSkipped', {});
    },
    async daysByMood() {
      const days = new Map<string, number>();
      for (const { choice } of (await userState.list(moodRecords.checkIns)).values()) {
        if (choice === SKIPPED || moodOf(choice) === undefined) continue;
        days.set(choice, (days.get(choice) ?? 0) + 1);
      }
      return days;
    },
    subscribe: subscribers.subscribe,
  };
}

/** What a reader sees of the check-in, so an unchanged day tells no one. */
const keyOf = (checkIn: MoodCheckIn) =>
  checkIn.state === 'chosen' ? `chosen:${checkIn.mood.id}` : checkIn.state;
