import type { EntryKind } from '@slovo/contracts';
import {
  kindsShown,
  type Edition,
  type FeatureSwitch,
  type MixState,
  type UserSettings,
} from '@slovo/core';

/** Every tab in its final order: Home, Game, Saved, Settings. */
const allTabs = ['home', 'game', 'saved', 'settings'] as const;

export type Tab = (typeof allTabs)[number];

/** What the reader is shown of the features an Edition can switch off or the reader can hide. */
export interface Shown {
  /** The tabs, in order: the Game's only when the Game is on. */
  readonly tabs: readonly Tab[];
  /** The Game Review under the Game's result. */
  readonly gameReview: boolean;
  /** The Mascot beside the question of a Round (ADR 0139). */
  readonly gameRoundMascot: boolean;
  /** The third end button «До стрічки» (ADR 0139). */
  readonly gameEndToFeed: boolean;
  /** The plain Game Review: rows that neither expand nor open the Entry (ADR 0139). */
  readonly plainGameReview: boolean;
  /** The Games hub in five groups (ADR 0139). */
  readonly gameHubGroups: boolean;
  /** «Рекорд: N з M» or «Ще жодної гри» and the board's line in a Games hub row (ADR 0139). */
  readonly gameHubRecord: boolean;
  /** The toast on a tap of a Game Mode that cannot be played (ADR 0139). */
  readonly gameModeToast: boolean;
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
  /** Whether those tabbed cards give the Entry's sources their own last tab «Джерело», out of the other tabs (ADR 0116). */
  readonly sourceTab: boolean;
  /** Whether a tabbed Tip card with exceptions shows them in a tab «Винятки» after «Правило» (ADR 0120). */
  readonly tipExceptions: boolean;
  /** Whether Entry details head every kind as a Word, in the red panel, and draw its meaning with no card frame (owner 15.11). */
  readonly entryPanelAllKinds: boolean;
  /** Whether the Lemma on the Word of the Day card in the Feed is set in the Edition's calligraphic font. */
  readonly calligraphicLemma: boolean;
  /** Whether an Entry card is in Self-check. */
  readonly selfCheck: boolean;
  /** The Settings switch for Self-check. */
  readonly selfCheckSetting: boolean;
  /** The Settings switch «Звуки». */
  readonly soundsSetting: boolean;
  /** The Settings row «Голос диктора» and its screen, where the reader chooses the Narrator Voice (ADR 0083). */
  readonly narratorVoiceSetting: boolean;
  /** The Settings switch for «Сезонний декор» (ADR 0055). */
  readonly seasonalDecorSetting: boolean;
  /** The Settings switch «Менше руху», which joins the system's Reduce Motion. */
  readonly reduceMotionSetting: boolean;
  /**
   * The three-step text size (ADR 0134): Word cards draw at the reader's step
   * on the ladder, and the S…XL row of Settings is gone. Off, the S…XL scale
   * and its row work as before.
   */
  readonly textSizeSteps: boolean;
  /** The switch «Анонімна статистика» on the privacy screen (ADR 0060, 0135). */
  readonly shareCountersSetting: boolean;
  /** «Експортувати мої дані» on the privacy screen (ADR 0135). */
  readonly dataExport: boolean;
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
  /** The Mascot's celebrations, while the XP log is on and the reader has not hidden the counters (ADR 0066). */
  readonly celebrations: boolean;
  /** The Profile's ladder of Level names, while its switch is on and the reader has not hidden the counters. */
  readonly levelLadder: boolean;
  /** The Profile's Break card while a Break runs, while its switch is on and the reader has not hidden the counters. */
  readonly breakCard: boolean;
  /** The Settings row of the Break and its screen. */
  readonly streakBreak: boolean;
  /** The line a tap on a day of the Active Days calendar on the Profile shows. */
  readonly calendarDayLines: boolean;
  /** The Profile's Streak freeze card, while the freezes are on and the reader has not hidden the counters. */
  readonly streakFreezeCard: boolean;
  /** The Settings row that opens the Badges (ADR 0066). */
  readonly badges: boolean;
  /** How many Badges are earned («1 з 21», a family's «0 з 4»), while the reader has not hidden the counters (ADR 0188). */
  readonly badgeCounts: boolean;
  /**
   * The offers to share a Level reached, a Badge earned or a Streak
   * milestone today, while Share Cards and the XP log are on and the reader
   * has not hidden the counters («Без лічильників»).
   */
  readonly progressShareCards: boolean;
  /** Board 08's «Розгадано!» screen once the crossing Daily Crossword is solved (ADR 0087). */
  readonly crosswordSolvedScreen: boolean;
  /** The crossing Daily Crossword's Solve time on its solved screen and share line (ADR 0087). */
  readonly crosswordSolveTime: boolean;
  /** The Settings row that opens the Profile, with the reader's whole progress. */
  readonly profile: boolean;
  /** Whether the Profile greets the reader by an optional name, with its «Ім’я» row (ADR 0136). */
  readonly readerName: boolean;
  /** The Profile's confirmed Entries by rarity. */
  readonly profileConfirmedByRarity: boolean;
  /** The Profile's Best result of each Game Mode. */
  readonly profileGameBest: boolean;
  /** The Quick Question in the Feed and its «Швидкі питання» row in the Mix; it asks the Game's Modes. */
  readonly quickQuestion: boolean;
  /** The Sync status line of the SLOVO ID screen. */
  readonly sync: boolean;
  /** The Daily Goal choice of Settings and the goal on the XP bar; it lives in the XP log. */
  readonly dailyGoal: boolean;
  /** The Search button of the «Стрічка» header, which opens the Search screen. */
  readonly search: boolean;
  /** The search field of the Saved tab, which opens the Search screen; it is Search itself, so it goes with it (ADR 0054). */
  readonly searchField: boolean;
  /** The fast reveal of the Feed's Entry cards after the first one in a visit; off, each plays the full reveal. */
  readonly fastReveal: boolean;
  /** The Feed header's wordmark opens the Dashboard (ADR 0079). */
  readonly dashboardWordmark: boolean;
  /** The Dashboard's logo plays the daily splash, the short cut, then the Dashboard again (ADR 0105). */
  readonly dailySplash: boolean;
  /** The Mascot in the Dashboard's hero throws sparks from its megaphone (ADR 0109). */
  readonly heroSparks: boolean;
  /** The «Стрічка» tab opens the Feed; the Dashboard stays the home at launch (ADR 0093). */
  readonly feedTab: boolean;
  /** A tap on a Word of a Category's screen opens the Category's Feed (ADR 0110). */
  readonly categoryFeed: boolean;
  /** The Mood check-in block of the Dashboard, «Як настрій?» (ADR 0076). */
  readonly mood: boolean;
  /** The Curated Collections rail of the Dashboard, «SLOVO пропонує» (ADR 0076, 0178). */
  readonly curatedCollections: boolean;
  /** A tap on an Entry of a Curated Collection's screen opens the collection's Feed (ADR 0178). */
  readonly curatedCollectionFeed: boolean;
  /** While the gestures hint is open, the Feed's card plays the swipes it names (ADR 0112). */
  readonly gesturesHintDemo: boolean;
  /** Settings offers «Показати підказку жестів», which shows the gestures hint once more (owner 16.11). */
  readonly gesturesHintAgain: boolean;
  /** The «Слова дня» card of the Saved tab and the Word of the Day archive it opens. */
  readonly wordOfTheDayArchive: boolean;
  /**
   * «Рідкість» in Settings (ADR 0156): `range`, the picker of both ends of the
   * Rarity Range; `top`, the row «до 1»…«до 5» of its top alone; `off`, none.
   */
  readonly rarity: 'off' | 'top' | 'range';
  /** The «Пройти тест ще раз» row of Settings, while the Rarity Range it sets is on as well. */
  readonly rarityTest: boolean;
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

/**
 * What the reader is shown, from the Edition in effect (ADR 0040), the
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
    tabs: allTabs.filter((tab) => tab !== 'game' || on('game')),
    gameReview: on('gameReview'),
    gameRoundMascot: on('gameRoundMascot'),
    gameEndToFeed: on('gameEndToFeed'),
    plainGameReview: on('plainGameReview'),
    gameHubGroups: on('gameHubGroups'),
    gameHubRecord: on('gameHubRecord'),
    gameModeToast: on('gameModeToast'),
    entryButtons: {
      shareCard: on('shareCards'),
      pronunciation: on('pronunciation'),
      knowledge,
      mistakeReport: on('mistakeReports'),
    },
    stressFall: on('stressAnimation'),
    sourceTab: on('sourceTab'),
    tipExceptions: on('tipExceptions'),
    entryPanelAllKinds: on('entryPanelAllKinds'),
    calligraphicLemma: on('calligraphy'),
    selfCheck: on('selfCheck') && settings.selfCheck,
    selfCheckSetting: on('selfCheck'),
    soundsSetting: on('sounds'),
    narratorVoiceSetting: on('narratorVoice'),
    seasonalDecorSetting: on('seasonalDecor'),
    reduceMotionSetting: on('reduceMotion'),
    textSizeSteps: on('textSizeSteps'),
    shareCountersSetting: on('communityCounters') || on('analytics'),
    dataExport: on('dataExport'),
    learning: knowledge,
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
    streakBreak: on('streakBreak'),
    calendarDayLines: on('calendarDayLines'),
    streakFreezeCard: on('streakFreezeCard') && on('streakFreezes') && !noCounters,
    badges: on('badges'),
    badgeCounts: !noCounters,
    progressShareCards: on('progressShareCards') && !noCounters,
    crosswordSolvedScreen: on('crosswordSolvedScreen'),
    crosswordSolveTime: on('crosswordSolveTime'),
    profile: on('profile'),
    readerName: on('readerName'),
    profileConfirmedByRarity: on('profileConfirmedByRarity'),
    profileGameBest: on('profileGameBest'),
    quickQuestion: on('quickQuestion'),
    sync: on('sync'),
    dailyGoal: on('dailyGoal'),
    search: on('searchButton'),
    searchField: on('search'),
    fastReveal: on('fastReveal'),
    dashboardWordmark: on('dashboardWordmark'),
    dailySplash: on('dailySplash'),
    heroSparks: on('heroSparks'),
    feedTab: on('feedTab'),
    categoryFeed: on('categoryFeed'),
    mood: on('mood'),
    curatedCollections: on('curatedCollections'),
    curatedCollectionFeed: on('curatedCollectionFeed'),
    gesturesHintDemo: on('gesturesHintDemo'),
    gesturesHintAgain: on('gesturesHintAgain'),
    wordOfTheDayArchive: on('wordOfTheDayArchive'),
    rarity: on('rarityCeiling') ? (on('rarityRange') ? 'range' : 'top') : 'off',
    rarityTest: on('rarityTest'),
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
