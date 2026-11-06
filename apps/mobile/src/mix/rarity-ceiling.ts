import type { Rarity } from '@slovo/contracts';

import { useComposition } from '../composition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';

/**
 * The Rarity Ceiling in force (ADR 0072), kept up to date, and the call that
 * sets it. A ceiling that could not be kept is logged and leaves it as it was.
 */
export function useRarityCeiling(): { ceiling: Rarity; setCeiling: (ceiling: number) => void } {
  const { rarityCeiling } = useComposition();
  const ceiling = useSubscribed(rarityCeiling, ({ state }) => state);
  return {
    ceiling,
    setCeiling: (next) => {
      void keep('the Rarity Ceiling', rarityCeiling.set(next));
    },
  };
}
