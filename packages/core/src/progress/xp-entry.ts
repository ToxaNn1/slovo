import type { Rarity } from '@slovo/contracts';

/** What every XP entry keeps, whatever its source. */
interface Logged {
  readonly kind: 'xp';
  /** The local date the XP was earned on, `YYYY-MM-DD`. */
  readonly date: string;
  /** The instant it was earned, ISO 8601 in UTC. */
  readonly at: string;
  readonly amount: number;
}

/** A Game Round answered right: its Game Mode and the rarity of its Word, for the Badges; none before them. */
export interface GameRoundEntry extends Logged {
  readonly source: 'game-round';
  readonly mode?: string | undefined;
  readonly rarity?: Rarity | undefined;
}

/** A finished Game: its Game Mode, right answers and Rounds played, for the Badges (ADR 0085); none before them. */
export interface GameFinishedEntry extends Logged {
  readonly source: 'game-finished';
  readonly mode?: string | undefined;
  readonly right?: number | undefined;
  readonly played?: number | undefined;
}

/** A Daily Crossword solve: its Solve time and whether the Crossword Hint was used (ADR 0087); none before them. */
export interface DailyCrosswordEntry extends Logged {
  readonly source: 'daily-crossword';
  readonly solveSeconds?: number | undefined;
  readonly hinted?: boolean | undefined;
}

/** XP of a source that keeps nothing besides its amount. */
export interface PlainXpEntry extends Logged {
  readonly source: 'game-best' | 'review-answer' | 'quick-question' | 'seen-word';
}

/**
 * The XP a learning action earned (ADR 0066), by XP source: each form holds
 * only the fields of its own source, in the order of the stored entry, so an
 * entry is written as the bytes it had.
 */
export type XpEntry = GameRoundEntry | GameFinishedEntry | DailyCrosswordEntry | PlainXpEntry;

/** An XP entry as the user state may hold it: the fields of every source at once. */
type StoredXpEntry = Logged & {
  readonly source: XpEntry['source'];
  readonly mode?: string | undefined;
  readonly rarity?: Rarity | undefined;
  readonly right?: number | undefined;
  readonly played?: number | undefined;
  readonly solveSeconds?: number | undefined;
  readonly hinted?: boolean | undefined;
};

/**
 * The entry a stored one reads as. Every stored entry reads, those kept
 * before the Badges fields too; the fields foreign to its source are ignored,
 * and the ones of its source kept as they are.
 */
export function xpEntryOf(stored: StoredXpEntry): XpEntry {
  const { kind, date, at, source, amount } = stored;
  switch (source) {
    case 'game-round':
      return { kind, date, at, source, amount, mode: stored.mode, rarity: stored.rarity };
    case 'game-finished':
      return {
        kind,
        date,
        at,
        source,
        amount,
        mode: stored.mode,
        right: stored.right,
        played: stored.played,
      };
    case 'daily-crossword':
      return {
        kind,
        date,
        at,
        source,
        amount,
        solveSeconds: stored.solveSeconds,
        hinted: stored.hinted,
      };
    default:
      return { kind, date, at, source, amount };
  }
}
