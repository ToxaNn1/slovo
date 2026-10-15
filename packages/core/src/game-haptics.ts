import type { Haptics } from './haptics';
import type { Schedule } from './ports';

/**
 * How long after a wrong answer its Life is lost: the time the wrong choice
 * takes to fill (200 ms), so the Life's medium haptic follows the answer's
 * warning instead of blurring into it. The Round's views start the Life's pop
 * and the fill's fade by it too, so the haptic and the pop come together.
 */
export const LIFE_LOST_DELAY = 200;

/** How long after the win's first success haptic its second one comes. */
export const WIN_SECOND_SUCCESS = 300;

/**
 * The haptics of a Game's changes, each a sequence over the app's `Haptics`.
 * The views tell it what happened and keep their animations to themselves.
 */
export interface GameHaptics {
  /** A right answer: success. */
  rightAnswer(): void;
  /** A wrong answer: warning, then the medium haptic of the Life it costs. */
  wrongAnswer(): void;
  /** A win: success, then success again. */
  win(): void;
  /** Drops the haptics still to come, as when the screen goes away. */
  stop(): void;
}

/**
 * Turns the Game's changes into their haptic sequences. Every haptic goes
 * through `haptics`, so Vibration decides when it comes, not when it was
 * scheduled.
 */
export function createGameHaptics({
  haptics,
  schedule,
}: {
  haptics: Haptics;
  schedule: Schedule;
}): GameHaptics {
  let cancels: (() => void)[] = [];

  function later(run: () => void, delay: number) {
    const cancel = schedule(() => {
      cancels = cancels.filter((pending) => pending !== cancel);
      run();
    }, delay);
    cancels.push(cancel);
  }

  return {
    rightAnswer() {
      haptics.success();
    },
    wrongAnswer() {
      haptics.warning();
      later(() => {
        haptics.impactMedium();
      }, LIFE_LOST_DELAY);
    },
    win() {
      haptics.success();
      later(() => {
        haptics.success();
      }, WIN_SECOND_SUCCESS);
    },
    stop() {
      for (const cancel of cancels) cancel();
      cancels = [];
    },
  };
}
