import type { Clock, Schedule } from '../ports';
import type { GameTime } from './round-machine';

/**
 * The play time of a timed Game: its clock run, stopped as the Game pauses
 * and run again from what was left, and the end it schedules once the time
 * runs out. One clock runs at a time, the one of the Game in play.
 */
export interface GameClock {
  /** The clock run from the play time left, its end scheduled in place of any before. */
  run(left: number): GameTime;
  /** Cancels the scheduled end, if any. */
  stop(): void;
  /** The time with its clock stopped, keeping what it had left; nothing unless the clock runs. */
  paused(time: GameTime | undefined): GameTime | undefined;
  /** The time with its clock run again from what it had left; nothing unless it is paused. */
  resumed(time: GameTime | undefined): GameTime | undefined;
  /** Whether the play time has run out by the clock. */
  isOut(time: GameTime | undefined): boolean;
}

/** The play time once it has run out. */
export const TIME_UP: GameTime = { left: 0, endsAt: undefined };

/**
 * Makes the play time of the Game. `timeUp` is told the time whose clock ran
 * out, for the Game to end unless it paused or ended since. Without a
 * schedule nothing ends the Game by itself: it ends on its first answer after.
 */
export function createGameClock({
  clock,
  schedule,
  timeUp,
}: {
  clock: Pick<Clock, 'now'>;
  schedule: Schedule | undefined;
  timeUp: (time: GameTime) => void;
}): GameClock {
  /** Cancels the end of the timed Game in play, scheduled while its clock runs. */
  let cancelTimeUp: (() => void) | undefined;

  function stop(): void {
    cancelTimeUp?.();
    cancelTimeUp = undefined;
  }

  function run(left: number): GameTime {
    const time: GameTime = { left, endsAt: new Date(clock.now().getTime() + left) };
    cancelTimeUp = schedule?.(() => {
      timeUp(time);
    }, left);
    return time;
  }

  return {
    run,
    stop,
    paused(time) {
      const endsAt = time?.endsAt;
      if (endsAt === undefined) return undefined;
      stop();
      return { left: Math.max(0, endsAt.getTime() - clock.now().getTime()), endsAt: undefined };
    },
    resumed: (time) =>
      time === undefined || time.endsAt !== undefined ? undefined : run(time.left),
    isOut: (time) => time?.endsAt !== undefined && time.endsAt.getTime() <= clock.now().getTime(),
  };
}
