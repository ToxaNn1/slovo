import type { Analytics } from '../analytics/analytics';
import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import type { Clock, Random } from '../ports';
import type { UserState } from '../user-state/user-state';
import type { GameXp } from './game-xp';

/** A solved Daily Crossword as its XP log record keeps it. */
export interface CrosswordSolve {
  readonly solveSeconds: number | undefined;
  readonly hinted: boolean;
}

/**
 * What the Daily Crossword needs of the XP log: the XP its solve earns, and
 * the solve of a date the log records, which Sync brings from every device.
 */
export interface CrosswordXp extends GameXp {
  crosswordSolveOn(date: string): CrosswordSolve | undefined;
}

/**
 * What the Daily Crossword opens over: the
 * Edition's Feature Switches and whatever else of the Edition one names.
 */
export interface CrosswordPorts<OfEdition extends keyof Edition = never> {
  entries: Pick<Entries, 'wordsInRarityRange'>;
  userState: UserState;
  clock: Clock;
  edition: Pick<Edition, 'isFeatureEnabled' | OfEdition>;
  /** The seeded random port of a seed; the Core's own by default. */
  seeded?: (seed: string) => Random;
  /** The XP log, which solving the day earns XP in and records the solve; without it, none. */
  xp?: CrosswordXp;
  analytics?: Pick<Analytics, 'track'>;
}

/** The XP of a Daily Crossword opened without an XP log: none, nothing to write and no solve recorded. */
export const noXp: CrosswordXp = {
  crosswordSolveOn: () => undefined,
  award: () => ({ changes: new Map(), amount: 0, commit: () => undefined }),
};
