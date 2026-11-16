import type { RarityRange } from '@slovo/contracts';

import { useComposition } from '../composition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';

/**
 * The Rarity Range in force (ADR 0156), kept up to date, and the call that
 * sets it, resolving once the range is kept and told. A range that could not
 * be kept is logged and leaves it as it was.
 */
export function useRarityRange(): {
  range: RarityRange;
  setRange: (range: { from: number; to: number }) => Promise<void>;
} {
  const { rarityRange } = useComposition();
  const range = useSubscribed(rarityRange, ({ state }) => state);
  return {
    range,
    setRange: (next) => keep('the Rarity Range', rarityRange.set(next)),
  };
}
