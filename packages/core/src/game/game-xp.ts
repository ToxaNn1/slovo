import type { UserStateChanges } from '../ports';

/**
 * A learning action that earns XP (ADR 0066): a Game Round answered right, a
 * finished Game with its right answers out of those given, a new Best result,
 * the Daily Crossword of a local date solved, and a Review answer.
 */
export type XpAction =
  | { readonly source: 'game-round' }
  | { readonly source: 'game-finished'; readonly right: number; readonly played: number }
  | { readonly source: 'game-best' }
  | { readonly source: 'daily-crossword'; readonly date: string }
  | { readonly source: 'review-answer' };

/**
 * The record an action appends, for a caller to write in one write with its
 * own, and the step that makes it in memory once it is written (ADR 0013).
 * An action that earns 0 XP, or any action with the switch off, appends
 * nothing: the changes are empty and `commit` changes nothing.
 */
export interface XpAward {
  readonly changes: UserStateChanges;
  /** How much the action earned, 0 when nothing is appended. */
  readonly amount: number;
  /** Makes the change in memory. Call it once the changes are written. */
  commit(): void;
}

/**
 * The XP the Game awards (ADR 0066): what the Game needs of the XP log, so
 * the Game names its learning actions and the XP log prices them.
 */
export interface GameXp {
  award(action: XpAction): XpAward;
}
