import type { GameState, GameTime, GivenAnswer } from '@slovo/core';
import { useEffect, useState } from 'react';

import { useComposition } from '../composition';
import { deviceClock } from '../device/device-clock';
import { useInForeground } from '../foreground/in-foreground';
import { keep } from '../keep';
import { logError } from '../diagnostics/log';
import { useSubscribed } from '../opening';

/** The Game as it stands, kept up to date. */
export function useGameState(): GameState {
  return useSubscribed(useComposition().game, ({ state }) => state);
}

/**
 * What the Game screens do: start a Game, answer, «Відкрити літеру», «Далі» and leave. A start
 * or a «Далі» that fails is logged and leaves the Game as it was. A «Не знаю»
 * mark of a wrong answer that fails to write is logged too, and the Game goes on.
 */
export function useGameActions() {
  const { game } = useComposition();
  return {
    start: (modeId: string) => {
      game.start(modeId).catch((error: unknown) => {
        logError('Could not start a Game', error);
      });
    },
    answer: (given: GivenAnswer) => {
      void keep('the Knowledge Mark', game.answer(given), undefined);
    },
    openLetter: () => {
      game.openLetter();
    },
    next: () => {
      game.next().catch((error: unknown) => {
        logError('Could not go on to the next Round', error);
      });
    },
    leave: () => {
      game.leave();
    },
  };
}

/**
 * Keeps the widget hint as shown once `shown` turns on, that is once it is on
 * screen, so no later Game offers it. A write that fails is logged.
 */
export function useWidgetHintShown(shown: boolean): void {
  const { game } = useComposition();
  useEffect(() => {
    if (shown) void keep('the widget hint shown', game.widgetHintShown(), undefined);
  }, [game, shown]);
}

/** How often the timer of a timed Game reads the clock, in milliseconds, so each second turns on time. */
const TICK_MS = 250;

/**
 * The play time a timed Game has left now, in milliseconds, read from the
 * clock while it runs and kept as the Core gave it while it is paused; none
 * in another Game.
 */
export function useTimeLeft(time: GameTime | undefined): number | undefined {
  const endsAt = time?.endsAt?.getTime();
  const [now, setNow] = useState(() => deviceClock.now().getTime());
  useEffect(() => {
    if (endsAt === undefined) return undefined;
    const tick = () => {
      setNow(deviceClock.now().getTime());
    };
    tick();
    const ticking = setInterval(tick, TICK_MS);
    return () => {
      clearInterval(ticking);
    };
  }, [endsAt]);
  if (time === undefined) return undefined;
  // Never more than the Core gave, before the first tick of a clock run again.
  return endsAt === undefined ? time.left : Math.max(0, Math.min(time.left, endsAt - now));
}

/**
 * Pauses the clock of a timed Game while the app is in the background and
 * runs it again on return, so that time never counts (ADR 0052). A pause or
 * a resume that fails is logged.
 */
export function usePauseInBackground(): void {
  const { game } = useComposition();
  const inForeground = useInForeground();
  useEffect(() => {
    (inForeground ? game.resume() : game.pause()).catch((error: unknown) => {
      logError('Could not pause or resume the Game', error);
    });
  }, [game, inForeground]);
}
