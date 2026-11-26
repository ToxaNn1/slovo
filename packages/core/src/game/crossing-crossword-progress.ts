import { createInTurn } from '../in-turn';
import { todayKey } from '../local-date';
import { staged, writeStaged } from '../user-state/staged-write';
import { userStateRecords } from '../user-state-schema';
import { generateCrossingCrossword, type CrossingPuzzle } from './crossing-crossword';
import {
  filledLetters,
  isCrossingSolved,
  playCrossing,
  solvedIds,
  startCrossingPlay,
  type CrossingAction,
  type CrossingMove,
  type CrossingPlay,
} from './crossing-play';
import { noXp, type CrosswordPorts, type CrosswordSolve } from './crossword-ports';
import { seededRandomOf } from './seeded-random';

const { crossingCrosswordProgress } = userStateRecords;

/**
 * How far the reader is with today's Daily Crossword, for its card: nothing
 * entered («Почати»), something entered («Продовжити»), or solved.
 */
export type DailyCrosswordProgress = 'untouched' | 'started' | 'solved';

/** Today's crossing Daily Crossword in play. */
export interface CrossingCrossword {
  readonly puzzle: CrossingPuzzle;
  readonly state: CrossingPlay;
  /**
   * Today's solve: the one the XP log records, which Sync brings from every
   * device, or the one this device's play made while the log keeps none,
   * with no Solve time; `undefined` until it is solved.
   */
  readonly solve: CrosswordSolve | undefined;
  /** How far the reader is, as the card says it: solved by {@link solve}, else by the letters filled. */
  readonly progress: DailyCrosswordProgress;
  /** Whether the Edition offers the Crossword Hint (`crosswordHint`); while it does not, a hint changes nothing. */
  readonly hint: boolean;
  /**
   * Plays the reader's action and says what it did. A hint, or a move that
   * solves a Word, keeps the progress on this device first, so a failed
   * write changes nothing; the solve of the day appends its XP in the same
   * write. Once the day is solved, here or on another device, a tick
   * changes nothing.
   */
  play(action: CrossingAction): Promise<CrossingMove>;
  /** Keeps the progress with the seconds so far: for when the time pauses, as the screen leaves or the app goes to the background. */
  keep(): Promise<void>;
}

/**
 * What opening the crossing Daily Crossword gives: `off` while the Edition
 * turns it off, `no-fill` when no block pattern fills with the Words within
 * the Rarity Range, so the card is not shown that day, or the
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
 * Opens the crossing Daily Crossword of the clock's local date,
 * with the progress this device made in it today. Its seed is the date and
 * the ids of the Words within the Rarity Range, so every reader with the
 * same Ceiling and Edition content gets the same puzzle on a date. The
 * progress is kept with the puzzle's fingerprint: a new local date, or
 * another puzzle the same day, starts empty; the trace is never kept. It is
 * not a Game and never touches Seen or Knowledge Marks; its progress stays on
 * this device with no Sync. The Word that solves the day appends its XP in
 * the same write, which the XP log gives once for the date (ADR 0066); the
 * record carries the Solve time and whether a hint was used, so they sync
 * with it, and answers today's solve. With `crosswordSolveTime` off a tick changes nothing and the
 * record carries no time.
 */
export async function openCrossingCrossword({
  entries,
  userState,
  clock,
  edition,
  seeded = seededRandomOf,
  xp = noXp,
  analytics,
}: CrosswordPorts<'languageTraits'>): Promise<CrossingCrosswordOpening> {
  if (!edition.isFeatureEnabled('dailyCrossword')) return { kind: 'off' };
  const timed = edition.isFeatureEnabled('crosswordSolveTime');
  const date = todayKey(clock);
  const words = await entries.wordsInRarityRange();
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
  const solveOf = (): CrosswordSolve | undefined =>
    xp.crosswordSolveOn(date) ??
    (isCrossingSolved(state) ? { solveSeconds: undefined, hinted: state.hinted } : undefined);
  const unmoved = (): CrossingMove => ({ state, outcome: { kind: 'nothing' } });
  const crossword: CrossingCrossword = {
    puzzle,
    hint,
    get state() {
      return state;
    },
    get solve() {
      return solveOf();
    },
    get progress() {
      if (solveOf() !== undefined) return 'solved';
      return Object.values(state.cells).some(({ kind }) => kind === 'filled')
        ? 'started'
        : 'untouched';
    },
    play: (action) =>
      inTurn(async () => {
        if (action.type === 'hint' && !hint) return unmoved();
        if (action.type === 'tick' && (!timed || solveOf() !== undefined)) return unmoved();
        const move = playCrossing(puzzle, state, action);
        const next = move.state;
        const hinted = action.type === 'hint' && next !== state;
        if (!hinted && move.outcome.kind !== 'hit') {
          state = next;
          return move;
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
        await writeStaged(userState, [staged(progressOf(next)), award]);
        state = next;
        // Out of turn: the next play never waits for the network.
        if (solves) void analytics?.track('dailyCrosswordSolved', { date }).catch(() => undefined);
        return move;
      }),
    keep: () => inTurn(() => userState.write(new Map(progressOf(state)))),
  };
  return { kind: 'open', crossword };
}
