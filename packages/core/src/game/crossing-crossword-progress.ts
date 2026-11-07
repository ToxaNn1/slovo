import type { Analytics } from '../analytics/analytics';
import type { Edition } from '../edition/edition';
import type { Entries } from '../entries/entries';
import { createInTurn } from '../in-turn';
import { todayKey } from '../local-date';
import type { Clock, Random } from '../ports';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';
import { generateCrossingCrossword, type CrossingPuzzle } from './crossing-crossword';
import {
  filledLetters,
  isCrossingSolved,
  playCrossing,
  solvedIds,
  startCrossingPlay,
  type CrossingAction,
  type CrossingPlay,
} from './crossing-play';
import type { GameXp } from './game-xp';
import { seededRandomOf } from './traced-crossword';

const { crossingCrosswordProgress } = userStateRecords;

/** Today's crossing Daily Crossword in play. */
export interface CrossingCrossword {
  readonly puzzle: CrossingPuzzle;
  readonly state: CrossingPlay;
  /** Whether the Edition offers the Crossword Hint (`crosswordHint`); while it does not, a hint changes nothing. */
  readonly hint: boolean;
  /**
   * Plays the reader's action. A hint, or a release that solves a Word,
   * keeps the progress on this device first, so a failed write changes
   * nothing; the solve of the day appends its XP in the same write.
   */
  play(action: CrossingAction): Promise<CrossingPlay>;
  /** Keeps the progress with the seconds so far: for when the time pauses, as the screen leaves or the app goes to the background. */
  keep(): Promise<void>;
}

/**
 * What opening the crossing Daily Crossword gives: `off` while the Edition
 * turns it off, `no-fill` when no block pattern fills with the Words within
 * the Rarity Ceiling, so the card is not shown that day (ADR 0087), or the
 * puzzle.
 */
export type CrossingCrosswordOpening =
  | { readonly kind: 'off' }
  | { readonly kind: 'no-fill' }
  | { readonly kind: 'open'; readonly crossword: CrossingCrossword };

/** The puzzle's Words, where they lie and the pre-filled cells, which the kept progress must match. */
function fingerprintOf(puzzle: CrossingPuzzle): string {
  const place = ({ row, column }: { row: number; column: number }) =>
    `${String(row)}.${String(column)}`;
  return [
    ...puzzle.words.map(({ word, direction, start }) =>
      [word.id, direction, place(start)].join(' '),
    ),
    ...puzzle.prefilled.map((cell) => `${place(cell.place)}=${cell.letter}`),
  ].join('\n');
}

/**
 * Opens the crossing Daily Crossword of the clock's local date (ADR 0087),
 * with the progress this device made in it today. Its seed is the date and
 * the ids of the Words within the Rarity Ceiling, so every reader with the
 * same Ceiling and Edition content gets the same puzzle on a date. The
 * progress is kept with the puzzle's fingerprint: a new local date, or
 * another puzzle the same day, starts empty; the trace is never kept. It is
 * not a Game and never touches Seen or Knowledge Marks; its progress stays on
 * this device with no Sync. The Word that solves the day appends its XP in
 * the same write, which the XP log gives once for the date (ADR 0066); the
 * record carries the Solve time and whether a hint was used, so they sync
 * with it. With `crosswordSolveTime` off a tick changes nothing and the
 * record carries no time.
 */
export async function openCrossingCrossword({
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
  edition: Pick<Edition, 'isFeatureEnabled' | 'languageTraits'>;
  /** The seeded random port of a seed; the Core's own by default. */
  seeded?: (seed: string) => Random;
  /** The XP log, which solving the day earns XP in; without it, none. */
  xp?: GameXp;
  analytics?: Pick<Analytics, 'track'>;
}): Promise<CrossingCrosswordOpening> {
  if (!edition.isFeatureEnabled('crossingCrossword')) return { kind: 'off' };
  const timed = edition.isFeatureEnabled('crosswordSolveTime');
  const date = todayKey(clock);
  const words = await entries.wordsUnderRarityCeiling();
  const generation = generateCrossingCrossword({
    date,
    words,
    alphabet: edition.languageTraits.alphabet,
    seeded,
  });
  if (generation.kind === 'no-fill') return generation;
  const { puzzle } = generation;

  const fingerprint = fingerprintOf(puzzle);
  const kept = await userState.read(crossingCrosswordProgress);
  const same = kept?.date === date && kept.puzzle === fingerprint;
  let state = startCrossingPlay(puzzle, same ? kept : undefined);
  const inTurn = createInTurn();
  const progressOf = (play: CrossingPlay) =>
    crossingCrosswordProgress.change({
      date,
      puzzle: fingerprint,
      filled: filledLetters(play),
      solved: solvedIds(puzzle, play),
      hinted: play.hinted,
      seconds: play.seconds,
    });

  const hint = edition.isFeatureEnabled('crosswordHint');
  const crossword: CrossingCrossword = {
    puzzle,
    hint,
    get state() {
      return state;
    },
    play: (action) =>
      inTurn(async () => {
        if (action.type === 'hint' && !hint) return state;
        if (action.type === 'tick' && !timed) return state;
        const next = playCrossing(puzzle, state, action);
        const hinted = action.type === 'hint' && next !== state;
        if (!hinted && solvedIds(puzzle, next).length === solvedIds(puzzle, state).length) {
          state = next;
          return state;
        }
        const solves = isCrossingSolved(next);
        const award = solves
          ? xp.award({
              source: 'daily-crossword',
              date,
              ...(timed ? { solveSeconds: next.seconds } : {}),
              ...(next.hinted ? { hinted: true } : {}),
            })
          : undefined;
        await userState.write(new Map([...progressOf(next), ...(award?.changes ?? [])]));
        award?.commit();
        state = next;
        if (solves) await analytics?.track('dailyCrosswordSolved', { date }).catch(() => undefined);
        return state;
      }),
    keep: () => inTurn(() => userState.write(new Map(progressOf(state)))),
  };
  return { kind: 'open', crossword };
}
