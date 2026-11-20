import { staged, writeStaged, type StagedPiece } from '../user-state/staged-write';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';
import type { GameRecords } from './game-xp';
import type { EndedGame, PlayedRound } from './round-machine';

const { gameBest } = userStateRecords;

/** What an answered Round records in the XP log, staged for a write, and the XP it earned. */
export interface RoundAward {
  /** The Round's record: its XP when right, else that it was answered wrong. */
  readonly piece: StagedPiece;
  /** The XP a right answer earned; 0 for a wrong one, or when the log records none. */
  readonly amount: number;
}

/** What a Game just over came to, once its end is written. */
export interface GameResult {
  /** The right answers: the Game's result, which its mode's Best result keeps. */
  readonly right: number;
  /** Whether the result is the mode's Best result now: its first, or above the one before. */
  readonly beaten: boolean;
  /** Whether the Game set a new Best result with a right answer; a first Game with a result of 0 sets none. */
  readonly newBest: boolean;
  /** The XP the whole Game earned: its Rounds, its end and its new Best result. */
  readonly xp: number;
}

/**
 * What the Game earns and keeps: the XP of each Round answered right, of a
 * finished Game and of a new Best result (ADR 0066), and each mode's Best
 * result, in the user state. It counts the XP of one Game at a time, the one
 * in play.
 */
export interface GameAwards {
  /** The Best result of each mode, read from the user state; a mode with none is left out. */
  bestResults(
    modes: readonly { readonly id: string }[],
  ): Promise<Readonly<Partial<Record<string, number>>>>;
  /** Starts counting the XP of a new Game. */
  start(): void;
  /** What the answered Round of a Game in the mode records, staged: write it at once. */
  round(modeId: string, round: PlayedRound): RoundAward;
  /** Writes the Round's record on its own, for a Game that goes on. */
  writeRound(award: RoundAward): Promise<void>;
  /** Counts the XP of a Round among the Game's, once its record is kept. */
  earned(award: RoundAward): void;
  /**
   * Ends the Game: its right answers the Best result when they beat `best`,
   * the one before, kept in the user state in one write with the XP of the
   * last Round, when it is given, of the finished Game and of the new Best
   * result, so a failed write changes nothing.
   */
  finish(ended: EndedGame, best: number | undefined, lastRound?: RoundAward): Promise<GameResult>;
}

/** Makes the awards of the Game over the XP log and the user state. */
export function createGameAwards({
  xp,
  userState,
}: {
  xp: GameRecords;
  userState: Pick<UserState, 'read' | 'write'>;
}): GameAwards {
  /** The XP the Game in play has earned so far, kept in the user state. */
  let earned = 0;

  /**
   * The record id of a mode's Best result: one per reset marker, so after a
   * Progress reset the mode has none until a Game after it.
   */
  function bestIdOf(modeId: string): string {
    const marker = xp.resetMarker;
    return marker === undefined ? modeId : `${modeId}~${marker.id}`;
  }

  return {
    async bestResults(modes) {
      const read = await Promise.all(
        modes.map(
          async ({ id }) => [id, await userState.read(gameBest.record(bestIdOf(id)))] as const,
        ),
      );
      return Object.fromEntries(read.filter(([, best]) => best !== undefined));
    },
    start() {
      earned = 0;
    },
    round(modeId, { right, entry }) {
      if (!right) return { piece: xp.answeredWrong(modeId), amount: 0 };
      const award = xp.award({
        source: 'game-round',
        mode: modeId,
        rarity: entry.kind === 'word' ? entry.rarity : undefined,
      });
      return { piece: award, amount: award.amount };
    },
    writeRound: ({ piece }) => writeStaged(userState, [piece]),
    earned({ amount }) {
      earned += amount;
    },
    async finish(ended, best, lastRound) {
      const right = ended.played.filter((round) => round.right).length;
      const beaten = best === undefined || right > best;
      // A Game with no right answer still sets the mode's first Best result but
      // earns no XP for it: the bonus rewards effort, not random tapping (story 3).
      const newBest = beaten && right > 0;
      const awards = [
        xp.award({
          source: 'game-finished',
          mode: ended.modeId,
          right,
          played: ended.played.length,
        }),
        ...(newBest ? [xp.award({ source: 'game-best' })] : []),
      ];
      await writeStaged(userState, [
        beaten ? staged(gameBest.record(bestIdOf(ended.modeId)).change(right)) : undefined,
        lastRound?.piece,
        ...awards,
      ]);
      const xpEarned =
        earned + (lastRound?.amount ?? 0) + awards.reduce((sum, { amount }) => sum + amount, 0);
      return { right, beaten, newBest, xp: xpEarned };
    },
  };
}
