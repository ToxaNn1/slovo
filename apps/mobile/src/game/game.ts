import type { GameState } from '@slovo/core';

import { useComposition } from '../composition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';

/** The Game as it stands, kept up to date. */
export function useGameState(): GameState {
  return useSubscribed(useComposition().game, ({ state }) => state);
}

/**
 * What the Game screens do: start a Game, answer, «Далі» and leave. A start
 * or a «Далі» that fails is logged and leaves the Game as it was. A «Не знаю»
 * mark of a wrong answer that fails to write is logged too, and the Game goes on.
 */
export function useGameActions() {
  const { game } = useComposition();
  return {
    start: (modeId: string) => {
      game.start(modeId).catch((error: unknown) => {
        console.error('Could not start a Game', error);
      });
    },
    answer: (option: number) => {
      void keep('the Knowledge Mark', game.answer(option), undefined);
    },
    next: () => {
      game.next().catch((error: unknown) => {
        console.error('Could not go on to the next Round', error);
      });
    },
    leave: () => {
      game.leave();
    },
  };
}
