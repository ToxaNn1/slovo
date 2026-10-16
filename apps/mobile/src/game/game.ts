import type { GameState } from '@slovo/core';

import { useComposed, useModule } from '../composition';

/** The Game as it stands, kept up to date; nothing until the composition is open. */
export function useGameState(): GameState | undefined {
  return useComposed(
    (composition) => composition.game,
    (game) => game.state,
    undefined,
  );
}

/**
 * What the Game screens do: start a Game, answer, «Далі» and leave. A start
 * or a «Далі» that fails is logged and leaves the Game as it was.
 */
export function useGameActions() {
  const game = useModule((composition) => composition.game);
  return {
    start: (modeId: string) => {
      game?.start(modeId).catch((error: unknown) => {
        console.error('Could not start a Game', error);
      });
    },
    answer: (option: number) => {
      game?.answer(option);
    },
    next: () => {
      game?.next().catch((error: unknown) => {
        console.error('Could not go on to the next Round', error);
      });
    },
    leave: () => {
      game?.leave();
    },
  };
}
