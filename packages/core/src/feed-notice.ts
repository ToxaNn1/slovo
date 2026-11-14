// The Feed Notice names sit at the root of the Core, beside `local-date.ts`, so
// the user-state schema can parse them without a cycle between `feed/` and
// `user-state/` (ADR 0027).

/**
 * The later questions of the questionnaire, each a Feed Notice, in the order
 * they are asked, one a local day (ADR 0067): the Daily Goal for a reader who
 * finished the onboarding before it asked one, the interests, the vocabulary
 * self-rating, the Rarity Test offer and the Mix review.
 */
export const LATER_QUESTIONS = [
  'wordGoalChoice',
  'interests',
  'selfRating',
  'rarityTest',
  'mixReview',
] as const;

/** A later question of the questionnaire. */
export type LaterQuestion = (typeof LATER_QUESTIONS)[number];

/**
 * The Feed Notice of the Daily Goal in XP, retired when the goal became Words
 * Seen and asked again as `wordGoalChoice`; a record kept from before still
 * names it, and reads without it.
 */
export const RETIRED_NOTICE = 'dailyGoalChoice';

/** The notice names without the retired one. */
export function withoutRetired<T extends string>(
  names: readonly (T | typeof RETIRED_NOTICE)[],
): T[] {
  return names.filter((name): name is T => name !== RETIRED_NOTICE);
}

/**
 * The Feed Notices, in the order the Feed shows those of one day: the Weekly
 * Recap, the Community Word, the first-week card, Yesterday, a level
 * milestone, a later question, the offer to save progress, «Ціль дня
 * виконано!» once the Daily Goal is met, «Може, на сьогодні досить?» after
 * 50 Seen Entries, and the notification explainer and its one re-ask (ADR
 * 0054, 0060, 0066, 0067, 0129).
 */
export const FEED_NOTICES = [
  'weeklyRecap',
  'communityWord',
  'firstWeek',
  'yesterday',
  'levelMilestone',
  ...LATER_QUESTIONS,
  'saveProgress',
  'goalReached',
  'enoughForToday',
  'notificationExplainer',
  'notificationReask',
] as const;

/** A Feed Notice: a Feed card that is not an Entry. */
export type FeedNotice = (typeof FEED_NOTICES)[number];
