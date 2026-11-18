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
  streakFreezeCard: ['xpLog'],
  breakCard: ['xpLog'],
  calendarDayLines: ['xpLog'],
  badgeSheet: ['xpLog', 'badges'],
  badgeFamiliesOverview: ['xpLog', 'badges'],
  profile: ['xpLog'],
  profileConfirmedByRarity: ['profile', 'confirmedEntries'],
  profileGameBest: ['profile', 'game'],
  // The board 11 parts (spec #1861).
  progressReset: ['xpLog'],
  readerName: ['profile'],
  widgetPreviews: ['widget'],
  dailyGoal: ['xpLog'],
  seenWordXp: ['xpLog', 'dailyGoal'],
  goalReachedCard: ['xpLog', 'dailyGoal'],
  progressShareCards: ['shareCards', 'xpLog'],
  // The parts of the Daily Crossword, the crossing one (ADR 0087, 0176).
  crosswordHint: ['dailyCrossword'],
  crosswordSolveTime: ['dailyCrossword'],
  crosswordSolvedScreen: ['dailyCrossword'],
  crosswordBadgeStamp: ['dailyCrossword', 'badges'],
  // The board «slogo game last» parts of a Game (spec #1880).
  gameRoundMascot: ['game'],
  gameEndToFeed: ['game'],
  gameModeToast: ['game'],
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
  // The Rarity Test sets the top of the Rarity Range (ADR 0156).
  rarityTest: ['rarityCeiling'],
  interestsQuestion: ['laterQuestions'],
  // «Попередні слова» is a Dashboard block over the Word of the Day archive (ADR 0076).
  previousWords: ['wordOfTheDayArchive'],
  // The Correction Types rail is a Dashboard block over the Corrections (ADR 0076).
  correctionTypes: ['corrections'],
  dueQuiz: ['knowledge'],
  collectionLinkCopy: ['collectionLinks'],
  // The demo plays the side swipes on the Feed's card (ADR 0112).
  gesturesHintDemo: ['knowledge'],
  gesturesHintAgain: ['knowledge'],
  // The line under the Mood check-in and the unpick (ADR 0185).
  moodEffect: ['mood'],
  // The Feed header's Search button opens the Search screen.
  searchButton: ['search'],
  // The grid of the Categories of Corrections opens from the Dashboard's Corrections rail (ADR 0081).
  correctionCategoryScreens: ['corrections'],
  correctionTypeGrid: ['correctionCategoryScreens'],
  // The Category's Feed opens from a Category's screen (ADR 0110).
  categoryFeed: ['categoryScreens'],
  // A Curated Collection's Feed opens from its screen (ADR 0178).
  curatedCollectionFeed: ['curatedCollections'],
  // The quiet variant is a variant of a Category screen (ADR 0081).
  notificationTimeStep: ['notifications'],
  // The explainer card asks for the permission the Notifications need.
  notificationExplainer: ['notifications'],
  // The Community Word is chosen from the Community Counters.
  communityWord: ['communityCounters'],
  // Sync runs for the reader's Account.
  sync: ['account'],
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
