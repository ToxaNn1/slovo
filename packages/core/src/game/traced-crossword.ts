import type { Analytics } from '../analytics/analytics';
import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { createInTurn } from '../in-turn';
import { todayKey } from '../local-date';
import type { Clock, Random } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';
import {
  foundIds,
  generateCrosswordPuzzle,
  isSolved,
  playPuzzle,
  startPuzzle,
  type CrosswordPuzzle,
  type PuzzleAction,
  type PuzzleState,
} from './crossword-puzzle';
import type { GameXp } from './game-xp';

const { tracedCrosswordProgress } = userStateRecords;

/** Today's traced Daily Crossword in play. */
export interface TracedCrossword {
  readonly puzzle: CrosswordPuzzle;
  readonly state: PuzzleState;
  /**
   * Plays the reader's action. A release that locks a Word keeps the Words
   * found on this device first, so a failed write changes nothing.
   */
  play(action: PuzzleAction): Promise<PuzzleState>;
}

/**
 * What opening the traced Daily Crossword gives: `off` while the Edition
 * turns it off, `no-tiling` when the Words within the Rarity Ceiling cannot
 * fill the grid, for the screen's fallback (ADR 0073), or the puzzle.
 */
export type TracedCrosswordOpening =
  | { readonly kind: 'off' }
  | { readonly kind: 'no-tiling' }
  | { readonly kind: 'open'; readonly crossword: TracedCrossword };

/** A 32-bit FNV-1a hash of the text. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

/** A seeded random port (mulberry32): the same draws for the same seed, on every device. */
export function seededRandomOf(seed: string): Random {
  let state = hash(seed);
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
    },
  };
}

/**
 * Opens the traced Daily Crossword of the clock's local date (ADR 0073), with
 * the Words this device found in it today. Its seed is the date and the ids of
 * the Words within the Rarity Ceiling, so every reader with the same Ceiling
 * and Edition content gets the same puzzle on a date. A new local date starts
 * with none found. It is not a Game and never touches Seen or Knowledge Marks;
 * its progress stays on this device with no Sync. The Word that solves it
 * appends its XP in the same write, which the XP log gives once for the date
 * (ADR 0066).
 */
export async function openTracedCrossword({
  entries,
  userState,
  clock,
  edition,
  seeded = seededRandomOf,
  xp = { award: () => ({ changes: new Map(), amount: 0, commit: () => undefined }) },
  analytics,
}: {
  entries: Pick<Entries, 'wordsUnderRarityCeiling'>;
  userState: UserState;
  clock: Clock;
  edition: Pick<Edition, 'isFeatureEnabled'>;
  /** The seeded random port of a seed; the Core's own by default. */
  seeded?: (seed: string) => Random;
  /** The XP log, which solving the day earns XP in; without it, none. */
  xp?: GameXp;
  analytics?: Pick<Analytics, 'track'>;
}): Promise<TracedCrosswordOpening> {
  if (!edition.isFeatureEnabled('tracedCrossword')) return { kind: 'off' };
  const date = todayKey(clock);
  const words = await entries.wordsUnderRarityCeiling();
  const seed = [date, ...words.map(({ id }) => id)].join('\n');
  const generation = generateCrosswordPuzzle({ date, words, random: seeded(seed) });
  if (generation.kind === 'no-tiling') return generation;
  const { puzzle } = generation;

  const kept = await userState.read(tracedCrosswordProgress);
  let state = startPuzzle(puzzle, kept?.date === date ? kept.found : []);
  const inTurn = createInTurn();

  const crossword: TracedCrossword = {
    puzzle,
    get state() {
      return state;
    },
    play: (action) =>
      inTurn(async () => {
        const next = playPuzzle(puzzle, state, action);
        const found = foundIds(puzzle, next);
        if (found.length === foundIds(puzzle, state).length) {
          state = next;
          return state;
        }
        const solves = isSolved(next);
        const award = solves ? xp.award({ source: 'daily-crossword', date }) : undefined;
        await userState.write(
          new Map([...tracedCrosswordProgress.change({ date, found }), ...(award?.changes ?? [])]),
        );
        award?.commit();
        state = next;
        if (solves) await analytics?.track('dailyCrosswordSolved', { date }).catch(() => undefined);
        return state;
      }),
  };
  return { kind: 'open', crossword };
}
