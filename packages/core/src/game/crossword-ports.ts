import type { Analytics } from '../analytics/analytics';
import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import type { Clock, Random } from '../ports';
import type { UserState } from '../user-state/user-state';
import type { GameXp } from './game-xp';

/**
 * What a Daily Crossword opens over, the traced and the crossing alike; the
 * Edition's Feature Switches and whatever else of the Edition one names.
 */
export interface CrosswordPorts<OfEdition extends keyof Edition = never> {
  entries: Pick<Entries, 'wordsUnderRarityCeiling'>;
  userState: UserState;
  clock: Clock;
  edition: Pick<Edition, 'isFeatureEnabled' | OfEdition>;
  /** The seeded random port of a seed; the Core's own by default. */
  seeded?: (seed: string) => Random;
  /** The XP log, which solving the day earns XP in; without it, none. */
  xp?: GameXp;
  analytics?: Pick<Analytics, 'track'>;
}

/** The XP of a Daily Crossword opened without an XP log: none, and nothing to write. */
export const noXp: GameXp = {
  award: () => ({ changes: new Map(), amount: 0, commit: () => undefined }),
};
