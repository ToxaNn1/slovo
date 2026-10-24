import type { MixKind, MixState } from '@slovo/core';
import { useEdition } from '@slovo/ui';
import { useMemo } from 'react';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { logError } from '../log';
import { useSubscribed } from '../opening';
import { mixSummary } from './mix-screen';

/** The Mix as it stands, kept up to date. */
export function useMixState(): MixState {
  return useSubscribed(useComposition().mix, ({ state }) => state);
}

/** The value of the «Мій Мікс» row of Settings. */
export function useMixSummary(): string {
  const state = useMixState();
  const { count } = useEdition();
  return useMemo(
    () => mixSummary({ mix: state, strings: editionStrings.mix, count }),
    [state, count],
  );
}

/**
 * The calls that change the Mix. A change that could not be kept is logged
 * and leaves the Mix as it was.
 */
export function useMixChanges(): {
  /** Puts the Category in the Mix (`inMix`) or takes it out. */
  toggleCategory: (categoryId: string, inMix: boolean) => void;
  turnAllOn: () => void;
  /** Puts the kind of Entry (Corrections, Idioms) as a whole in the Mix (`inMix`) or takes it out. */
  setKind: (kind: MixKind, inMix: boolean) => void;
  setRarityFloor: (floor: number) => void;
} {
  const { mix } = useComposition();
  const keep = (change: Promise<unknown>) => {
    change.catch((error: unknown) => {
      logError('Could not keep the change of the Mix', error);
    });
  };
  return {
    toggleCategory: (categoryId, inMix) => {
      keep(inMix ? mix.putBack(categoryId) : mix.takeOut(categoryId));
    },
    turnAllOn: () => {
      keep(mix.turnAllOn());
    },
    setKind: (kind, inMix) => {
      keep(mix.setKind(kind, inMix));
    },
    setRarityFloor: (floor) => {
      keep(mix.setRarityFloor(floor));
    },
  };
}
