import type { FeatureSwitch } from './edition';

/** The Feature Switches of the Game Modes and the Daily Crossword, each off while `game` is (ADR 0052). */
const GAME_PART_SWITCHES = [
  'gameGuessWord',
  'gameCorrection',
  'gameStress',
  'gamePairs',
  'gameSurvival',
  'gameTimed',
  'gameIdiomMeaning',
  'gameAnglicism',
  'gameBuildIdiom',
  'gameTypeWord',
  'gameAnagram',
  'gameByLetters',
  'gameOrigin',
  'dailyCrossword',
] as const satisfies readonly FeatureSwitch[];

/**
 * What each Feature Switch depends on: a feature is in effect only while
 * every switch it names here is in effect too (ADR 0040). A feature not
 * listed depends on nothing. Every rule between two switches lives here, so
 * the shell and the Core ask one question of the Edition.
 */
export const DEPENDS_ON: Partial<Record<FeatureSwitch, readonly FeatureSwitch[]>> = {
  ...Object.fromEntries(GAME_PART_SWITCHES.map((feature) => [feature, ['game']])),
  // The Game Modes that ask Corrections.
  gameCorrection: ['game', 'corrections'],
  gameSurvival: ['game', 'corrections'],
  gameAnglicism: ['game', 'corrections'],
  gameTypeWord: ['game', 'corrections'],
  // The Game Modes that ask Idioms.
  gameIdiomMeaning: ['game', 'idioms'],
  gameBuildIdiom: ['game', 'idioms'],
  // The 1.0 progress features all stand on the XP log (ADR 0066).
  levels: ['xpLog'],
  streakFreezes: ['xpLog'],
  streakBreak: ['xpLog'],
  badges: ['xpLog'],
  // The board 10 parts of the Profile and the Badges (ADR 0085).
  levelLadder: ['xpLog'],
  newLevelScreen: ['xpLog'],
  streakFreezeCard: ['xpLog'],
  breakCard: ['xpLog'],
  calendarDayLines: ['xpLog'],
  badgeSheet: ['xpLog', 'badges'],
  badgeToast: ['xpLog', 'badges'],
  profile: ['xpLog'],
  profileConfirmedByRarity: ['profile', 'confirmedEntries'],
  profileGameBest: ['profile', 'game'],
  dailyGoal: ['xpLog'],
  seenWordXp: ['xpLog', 'dailyGoal'],
  progressShareCards: ['shareCards', 'xpLog'],
  dailyCrosswordShare: ['shareCards', 'dailyCrossword'],
  tracedCrossword: ['dailyCrossword'],
  // The crossing Daily Crossword and its parts (ADR 0087).
  crossingCrossword: ['dailyCrossword'],
  crosswordHint: ['crossingCrossword'],
  crosswordSolveTime: ['crossingCrossword'],
  crosswordSolvedScreen: ['crossingCrossword'],
  crosswordBadgeStamp: ['crossingCrossword', 'badges'],
  // The board 07 parts of a Game (spec #1674).
  gameAnswerCard: ['game'],
  letterTiles: ['gameByLetters'],
  survivalStreak: ['gameSurvival'],
  finishPoster: ['game'],
  quickQuestion: ['game'],
  quickQuestionWordMeaning: ['quickQuestion'],
  playStep: ['game'],
  // The events of the admin's Аналітика go only with Analytics (spec #1709).
  analyticsSessions: ['analytics'],
  analyticsFeatureUsed: ['analytics'],
  analyticsSearchNoResult: ['analytics'],
  analyticsNotificationPermission: ['analytics'],
  analyticsNps: ['analytics'],
  analyticsGames: ['analytics'],
  // The Rarity Test sets the Rarity Ceiling (ADR 0072).
  rarityTest: ['rarityCeiling'],
  // The Dashboard's hero is the Word of the Day (ADR 0076).
  dashboard: ['wordOfTheDay'],
  // The Mood check-in is a Dashboard block (ADR 0076).
  mood: ['dashboard'],
  // «Попередні слова» is a Dashboard block over the Word of the Day archive (ADR 0076).
  previousWords: ['dashboard', 'wordOfTheDayArchive'],
  // The Correction Types rail is a Dashboard block over the Corrections (ADR 0076).
  correctionTypes: ['dashboard', 'corrections'],
  // The Curated Collections rail is a Dashboard block (ADR 0076).
  curatedCollections: ['dashboard'],
  // A swipe sets a Knowledge Mark.
  swipeMarks: ['knowledge'],
  // The demo plays the side swipes on the Feed's card (ADR 0112).
  gesturesHintDemo: ['swipeMarks'],
  // The source tab is the last of the Entry card's tabs (ADR 0116).
  sourceTab: ['wordTabs'],
  // «Винятки» is a tab of the Tip card's tabs (ADR 0120).
  tipExceptions: ['wordTabs'],
  // The Feed header's Search button opens the Search screen.
  searchButton: ['search'],
  // The wordmark leads to the Dashboard (ADR 0079).
  dashboardWordmark: ['dashboard'],
  // The daily splash plays from the Dashboard's logo (ADR 0105).
  dailySplash: ['dashboard'],
  // The sparks fly in the Dashboard's hero (ADR 0109).
  heroSparks: ['dashboard'],
  // The «Стрічка» tab opens the Feed the Dashboard otherwise opens (ADR 0093).
  feedTab: ['dashboard'],
  // The Categories rail and its grid are Dashboard blocks (ADR 0081).
  categoryScreens: ['dashboard'],
  // The grid of the Categories of Corrections opens from the Dashboard's Corrections rail (ADR 0081).
  correctionCategoryScreens: ['dashboard', 'corrections'],
  // The Category's Feed opens from a Category's screen (ADR 0110).
  categoryFeed: ['categoryScreens'],
  categoryKnownFirst: ['categoryScreens'],
  // The quiet variant is a variant of a Category screen (ADR 0081).
  quietCategories: ['categoryScreens'],
  notificationTimeStep: ['notifications'],
  // The explainer card asks for the permission the Notifications need.
  notificationExplainer: ['notifications'],
  // The Community Word is chosen from the Community Counters.
  communityWord: ['communityCounters'],
  // Sync runs for the reader's Account.
  sync: ['account'],
  // The hint after a Game points to the widget.
  widgetHint: ['widget'],
  // The reader's choice of voice only changes what Pronunciation plays (ADR 0083).
  narratorVoice: ['pronunciation'],
};

/**
 * Whether a feature is in effect, from whether each switch is on by itself:
 * its own switch on and every switch it depends on in effect, such as a Game
 * Mode only while `game` is on too (ADR 0052).
 */
export function switchedOn(isOn: (feature: FeatureSwitch) => boolean) {
  const inEffect = (feature: FeatureSwitch): boolean =>
    isOn(feature) && (DEPENDS_ON[feature] ?? []).every(inEffect);
  return inEffect;
}
