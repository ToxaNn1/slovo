import type { EntryKind } from '@slovo/contracts';
import {
  featureOfKind,
  MIX_KINDS,
  type Edition,
  type FeatureSwitch,
  type MixState,
  type UserSettings,
} from '@slovo/core';

/** Every tab in its final order: Home, Settings, Game, Saved. */
const allTabs = ['home', 'settings', 'game', 'saved'] as const;

export type Tab = (typeof allTabs)[number];

/** What the reader is shown of the features an Edition can switch off or the reader can hide. */
export interface Shown {
  /** The tabs, in order: the Game's only when the Game is on. */
  readonly tabs: readonly Tab[];
  /** The Game Review under the Game's result. */
  readonly gameReview: boolean;
  /** The switchable buttons of an Entry card, wherever the card appears. */
  readonly entryButtons: {
    /** The Share Card button of the action row. */
    readonly shareCard: boolean;
    /** The Pronunciation button of the Word card. */
    readonly pronunciation: boolean;
    /** The «Знаю» and «Не знаю» buttons of the action row. */
    readonly knowledge: boolean;
    /** The «Повідомити про помилку» flag of the action row (ADR 0056). */
    readonly mistakeReport: boolean;
  };
  /** Whether the Stress mark of a Word card's Lemma falls onto its vowel in the Feed and on the Entry screen. */
  readonly stressFall: boolean;
  /** Whether the Lemma on the Word of the Day card in the Feed is set in the Edition's calligraphic font. */
  readonly calligraphicLemma: boolean;
  /** Whether an Entry card is in Self-check. */
  readonly selfCheck: boolean;
  /** The Settings switch for Self-check. */
  readonly selfCheckSetting: boolean;
  /** The Settings switch for «Сезонний декор» (ADR 0055). */
  readonly seasonalDecorSetting: boolean;
  /** The Settings switch «Ділитися анонімною статистикою», with its privacy policy link (ADR 0060). */
  readonly shareCountersSetting: boolean;
  /**
   * The Settings switch of the counters: «Без лічильників» while its Feature
   * Switch is on; else «Приховати Серію» of 0.9 while the statistics are on;
   * else none.
   */
  readonly countersSetting: 'noCounters' | 'hideStreak' | undefined;
  /** The «Вчу» card of the Saved tab and the list it opens. */
  readonly learning: boolean;
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
  /** The Settings row of the Break and its screen. */
  readonly streakBreak: boolean;
  /** The Settings row that opens the Badges (ADR 0066). */
  readonly badges: boolean;
  /** The Quick Question in the Feed and its «Швидкі питання» row in the Mix; it asks the Game's Modes. */
  readonly quickQuestion: boolean;
  /** The Sync status line of the SLOVO ID screen. */
  readonly sync: boolean;
  /** The Daily Goal choice of Settings and the goal on the XP bar; it lives in the XP log. */
  readonly dailyGoal: boolean;
  /** The Search button of the «Головна» header, which opens the Search screen. */
  readonly search: boolean;
  /** The 🎲 «Слово під настрій» of the «Головна» header, which opens the moods. */
  readonly moods: boolean;
  /** The «Слова дня» card of the Saved tab and the Word of the Day archive it opens. */
  readonly wordOfTheDayArchive: boolean;
  /** The «Пройти тест ще раз» row of Settings, while the Rarity Floor it sets is on as well. */
  readonly rarityTest: boolean;
  /** The «Пройти опитування ще раз» row of Settings, with the self-rating while the Rarity Floor is on. */
  readonly questionnaire: { readonly selfRating: boolean } | undefined;
}

/**
 * What the reader is shown, from the Edition in effect (ADR 0040), the
 * reader's settings and their Mix. A feature shows only while its Feature
 * Switch is on in effect; the reader may hide the counters (or, with
 * «Без лічильників» switched off, only the Streak) and turns
 * Self-check on, and the Known Corrections, Idioms, Synonym Rows and Tips
 * each count only while they are in the Mix as well.
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
  // «Без лічильників» hides every counter; with its switch off it is «Приховати Серію» of 0.9 and hides only the Streak.
  const noCounters = on('noCounters') && settings.noCounters;
  // The kinds the Known count joins: Words, and every kind as a whole while on and in the Mix.
  const knownKinds: readonly EntryKind[] = [
    'word',
    ...MIX_KINDS.filter((kind) => on(featureOfKind(kind)) && mix.kinds[kind]),
  ];
  return {
    tabs: allTabs.filter((tab) => tab !== 'game' || on('game')),
    gameReview: on('gameReview'),
    entryButtons: {
      shareCard: on('shareCards'),
      pronunciation: on('pronunciation'),
      knowledge,
      mistakeReport: on('mistakeReports'),
    },
    stressFall: on('stressAnimation'),
    calligraphicLemma: on('calligraphy'),
    selfCheck: on('selfCheck') && settings.selfCheck,
    selfCheckSetting: on('selfCheck'),
    seasonalDecorSetting: on('seasonalDecor'),
    shareCountersSetting: on('communityCounters') || on('analytics'),
    countersSetting: on('noCounters') ? 'noCounters' : on('statistics') ? 'hideStreak' : undefined,
    learning: knowledge,
    stats: on('statistics')
      ? {
          streak: !settings.noCounters,
          knowledge: knowledge ? knownKinds : 'none',
        }
      : undefined,
    xpBar: on('xpLog') && !noCounters,
    streakBreak: on('xpLog') && on('streakBreak'),
    badges: on('xpLog') && on('badges'),
    quickQuestion: on('game') && on('quickQuestion'),
    sync: on('sync'),
    dailyGoal: on('xpLog') && on('dailyGoal'),
    search: on('search'),
    moods: on('moods'),
    wordOfTheDayArchive: on('wordOfTheDayArchive'),
    rarityTest: on('rarityTest') && on('rarityFloor'),
    questionnaire: on('laterQuestions') ? { selfRating: on('rarityFloor') } : undefined,
  };
}
