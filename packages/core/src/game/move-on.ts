import type { Schedule } from '../ports';
import type { GameOverStatus, PlayingGame } from './round-machine';

/**
 * How long the answer banner shows before the Game moves on by itself, in
 * milliseconds: after a right and a wrong answer, and in a
 * Game Mode with a time limit, whose clock keeps running under it. A wrong
 * answer in a Game with no time limit keeps its banner, with the right
 * answer, until «Далі».
 */
const ANSWER_BANNER_DELAYS = {
  untimed: { right: 950, wrong: undefined },
  timed: { right: 550, wrong: 3000 },
} as const;

/**
 * How long the banner of an answered Round shows before the Game moves on by
 * itself, in milliseconds; undefined when it waits for «Далі»: with no banner,
 * or after a wrong answer in a Game with no time limit.
 */
export function answerBannerDelay(
  game: PlayingGame | { readonly status: GameOverStatus; readonly timeLimit?: number },
): number | undefined {
  if (game.status !== 'answered' || !game.banner) return undefined;
  return ANSWER_BANNER_DELAYS[game.timeLimit === undefined ? 'untimed' : 'timed'][
    game.answered.kind
  ];
}

/** The move on from an answered Round by itself, as its answer banner shows. */
export interface MoveOn {
  /**
   * With the answer banner on, moves the Game on from the answered Round by
   * itself once its delay, if it has one, has passed and what the screen
   * waits for has come. A Round answered with no banner, such as a pair of a
   * pairs grid, waits for «Далі».
   */
  later(shown: PlayingGame): void;
  /** Has the move on to come wait for `done` as well as its delay; nothing with none to come. */
  waitFor(done: Promise<unknown>): void;
  /** Cancels the move on to come, if any. */
  stop(): void;
}

/**
 * Makes the move on of the Game. `moveOn` is told the answered Game the
 * delay was for, to go on from unless the Game moved on, ended or was left
 * since. Without a schedule nothing moves the Game on.
 */
export function createMoveOn({
  schedule,
  moveOn,
}: {
  schedule: Schedule | undefined;
  moveOn: (shown: PlayingGame) => Promise<void>;
}): MoveOn {
  /** Cancels the move on from the answered Round, scheduled as its banner shows. */
  let cancel: (() => void) | undefined;
  /** What the move on from the answered Round waits for besides its delay, such as VoiceOver. */
  let waits: Promise<unknown>[] = [];

  function stop(): void {
    cancel?.();
    cancel = undefined;
    waits = [];
  }

  return {
    later(shown) {
      const delay = answerBannerDelay(shown);
      if (schedule === undefined || delay === undefined) return;
      stop();
      cancel = schedule(() => {
        const waited = waits;
        cancel = undefined;
        waits = [];
        void Promise.allSettled(waited)
          .then(() => moveOn(shown))
          .catch(() => undefined);
      }, delay);
    },
    waitFor(done) {
      if (cancel !== undefined) waits.push(done);
    },
    stop,
  };
}
