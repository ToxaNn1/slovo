import type { EntryKind, MixPlace } from '@slovo/contracts';
import {
  kindsShown,
  statisticsGoverned,
  type Edition,
  type FeatureSwitch,
  type MixState,
  type UserSettings,
} from '@slovo/core';

/** Every tab in its final order: Home, Game, Mix in the centre, Saved, Settings (ADR 0201). */
const allTabs = ['home', 'game', 'mix', 'saved', 'settings'] as const;

export type Tab = (typeof allTabs)[number];

/**
 * What the reader is shown where more than one Feature Switch, a setting or
 * the Mix decide it together. A feature that one switch alone decides is read
 * where it is drawn, with `useEditionInEffect().isFeatureEnabled(…)`.
 */
export interface Shown {
  /** The tabs, in order: the Game's only when the Game is on, the Mix's only when the mixTab switch is. */
  readonly tabs: readonly Tab[];
  /** Where the texts that send the reader to their Mix send them: the tab «Теми», or Settings' «Мої Теми» without it. */
  readonly mixPlace: MixPlace;
  /** Whether an Entry card is in Self-check. */
  readonly selfCheck: boolean;
  /** The switch «Анонімна статистика» on the privacy screen (ADR 0135). */
  readonly shareCountersSetting: boolean;
  /**
   * The Stats pill and the stats sheet, with the setting that hides the Streak;
   * left out while the statistics are off.
   */
  readonly stats:
    | {
        /** The Streak and the Best Streak. */
        readonly streak: boolean;
        /**
         * The knowledge rows, with the kinds of Entry whose Known count shows, in
         * order: the Words, then the Corrections, the Idioms, the Synonym Rows and
         * the Tips unless left out; or none.
         */
        readonly knowledge: readonly EntryKind[] | 'none';
      }
    | undefined;
  /**
   * The XP bar over the Feed with today's XP, while the XP log is on and the
   * reader has not hidden the counters («Без лічильників», ADR 0066).
   */
  readonly xpBar: boolean;
  /** The Mascot's celebrations, while the XP log is on and the reader has not hidden the counters (ADR 0066). */
  readonly celebrations: boolean;
  /** The Profile's ladder of Level names, while its switch is on and the reader has not hidden the counters. */
  readonly levelLadder: boolean;
  /** The Profile's Break card while a Break runs, while its switch is on and the reader has not hidden the counters. */
  readonly breakCard: boolean;
  /** The Profile's Streak freeze card, while the freezes are on and the reader has not hidden the counters. */
  readonly streakFreezeCard: boolean;
  /** How many Badges are earned («1 з 21», a family's «0 з 4»), while the reader has not hidden the counters. */
  readonly badgeCounts: boolean;
  /** The Profile's «Сьогодні зарахується…» with the Words Seen of the Daily Goal, while the reader has not hidden the counters. */
  readonly todayPending: boolean;
  /**
   * The offers to share a Level reached, a Badge earned or a Streak
   * milestone today, while Share Cards and the XP log are on and the reader
   * has not hidden the counters («Без лічильників»).
   */
  readonly progressShareCards: boolean;
  /**
   * The «Анкета: підлаштувати Стрічку» row of Settings, while any of its questions
   * is on: «Рівень» and «Навіщо» under the questionnaire, the self-rating
   * under the Rarity Test it offers, the interests under «Що тобі цікаво?».
   */
  readonly questionnaire:
    | {
        readonly levelWhy: boolean;
        readonly selfRating: boolean;
        readonly interests: boolean;
      }
    | undefined;
}

/** Where the Mix is: the tab «Теми» while the mixTab switch is in effect, Settings' «Мої Теми» while it is not (ADR 0201). */
export function mixPlaceOf(edition: Pick<Edition, 'isFeatureEnabled'>): MixPlace {
  return edition.isFeatureEnabled('mixTab') ? 'tab' : 'settings';
}

/**
 * What the reader is shown, from the Edition in effect, the
 * reader's settings and their Mix. A feature shows only while its Feature
 * Switch is in effect, which the Edition answers with its dependencies
 * applied; the reader may hide the counters (or, with «Без лічильників»
 * switched off, only the Streak) and turns Self-check on. Only which screen
 * draws what lives here.
 */
export function shownOf({
  edition,
  settings,
  mix,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  settings: Pick<UserSettings, 'noCounters' | 'selfCheck'>;
  mix: Pick<MixState, 'kinds'>;
}): Shown {
  const on = (feature: FeatureSwitch) => edition.isFeatureEnabled(feature);
  const knowledge = on('knowledge');
  // «Без лічильників» hides every counter.
  const noCounters = settings.noCounters;
  return {
    tabs: allTabs.filter(
      (tab) => (tab !== 'game' || on('game')) && (tab !== 'mix' || on('mixTab')),
    ),
    mixPlace: mixPlaceOf(edition),
    selfCheck: on('selfCheck') && settings.selfCheck,
    shareCountersSetting: statisticsGoverned(edition),
    stats: on('statistics')
      ? {
          streak: !settings.noCounters,
          knowledge: knowledge ? kindsShown({ edition, mix }) : 'none',
        }
      : undefined,
    xpBar: on('xpLog') && !noCounters,
    celebrations: on('xpLog') && !noCounters,
    levelLadder: on('levelLadder') && !noCounters,
    breakCard: on('breakCard') && !noCounters,
    streakFreezeCard: on('streakFreezeCard') && !noCounters,
    badgeCounts: !noCounters,
    todayPending: !noCounters,
    progressShareCards: on('progressShareCards') && !noCounters,
    questionnaire:
      on('questionnaire') || on('rarityTest') || on('interestsQuestion')
        ? {
            levelWhy: on('questionnaire'),
            selfRating: on('rarityTest'),
            interests: on('interestsQuestion'),
          }
        : undefined,
  };
}
