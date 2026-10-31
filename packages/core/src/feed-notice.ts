// The Feed Notice names sit at the root of the Core, beside `local-date.ts`, so
// the user-state schema can parse them without a cycle between `feed/` and
// `user-state/` (ADR 0027).

/**
 * The Feed Notices, in the order the Feed shows those of one day: the Weekly
 * Recap, the Community Word, the first-week card, Yesterday, a level
 * milestone, and «Може, на сьогодні досить?» after 50 Seen Entries (ADR
 * 0054, 0060, 0066).
 */
export const FEED_NOTICES = [
  'weeklyRecap',
  'communityWord',
  'firstWeek',
  'yesterday',
  'levelMilestone',
  'enoughForToday',
] as const;

/** A Feed Notice: a Feed card that is not an Entry. */
export type FeedNotice = (typeof FEED_NOTICES)[number];
