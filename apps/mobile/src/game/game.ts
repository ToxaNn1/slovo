import type { GameState, GameTime, GivenAnswer } from '@slovo/core';
import { useEffect, useState } from 'react';

import { useComposition } from '../composition';
import { deviceClock } from '../device/device-clock';
import { useInForeground } from '../foreground/in-foreground';
import { keep } from '../keep';
import { useSubscribed } from '../opening';

/** The Game as it stands, kept up to date. */
export function useGameState(): GameState {
  return useSubscribed(useComposition().game, ({ state }) => state);
}

/**
 * What the Game screens do: start a Game, answer, «Відкрити літеру», «Далі», hold an answered
 * Round for what its banner waits for, and leave. A start
 * or a «Далі» that fails is logged and leaves the Game as it was. A «Не знаю»
 * mark of a wrong answer that fails to write is logged too, and the Game goes on.
 */
export function useGameActions() {
  const { game } = useComposition();
  return {
    /** Starts a Game of the mode, and says whether one started: a mode short of Entries starts none. */
    start: async (modeId: string): Promise<boolean> => {
      await keep('the Game start', game.start(modeId));
      return game.state.current !== undefined;
    },
    answer: (given: GivenAnswer) => {
      void keep('the Knowledge Mark', game.answer(given));
    },
    openLetter: () => {
      game.openLetter();
    },
    next: () => {
      void keep('the next Round', game.next());
    },
    waitFor: (done: Promise<unknown>) => {
      game.waitFor(done);
    },
    leave: () => {
      game.leave();
    },
  };
}

/**
 * The play time a timed Game has left now, in milliseconds, read from the
 * clock while it runs and kept as the Core gave it while it is paused; none
 * in another Game. It reads the clock as each whole second of the time left
 * turns, and only then, so the screen draws again once a second (the bar
 * empties on its own between).
 */
export function useTimeLeft(time: GameTime | undefined): number | undefined {
  const endsAt = time?.endsAt?.getTime();
  const [now, setNow] = useState(() => deviceClock.now().getTime());
  useEffect(() => {
    if (endsAt === undefined) return undefined;
    let next: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const at = deviceClock.now().getTime();
      setNow(at);
      const left = endsAt - at;
      if (left > 0) next = setTimeout(tick, left % 1000 || 1000);
    };
    tick();
    return () => {
      clearTimeout(next);
    };
  }, [endsAt]);
  if (time === undefined) return undefined;
  // Never more than the Core gave, before the first tick of a clock run again.
  return endsAt === undefined ? time.left : Math.max(0, Math.min(time.left, endsAt - now));
}

/**
 * Pauses the clock of a timed Game while the app is in the background and
 * runs it again on return, so that time never counts. A pause or
 * a resume that fails is logged.
 */
export function usePauseInBackground(): void {
  const { game } = useComposition();
  const inForeground = useInForeground();
  useEffect(() => {
    void keep('the Game pause or resume', inForeground ? game.resume() : game.pause());
  }, [game, inForeground]);
}
