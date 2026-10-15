import type { Mix, MixState } from '@slovo/core';
import { useEdition } from '@slovo/ui';
import { useMemo } from 'react';

import { useComposed, useModule } from './composition';
import { editionStrings } from './edition';
import { mixSummary } from './mix-screen';

/** The Mix of the session's Core composition, once it is open. */
function useMix(): Mix | undefined {
  return useModule((composition) => composition.mix);
}

/** The Mix as it stands, kept up to date; nothing until the Mix opens. */
export function useMixState(): MixState | undefined {
  return useComposed(
    (composition) => composition.mix,
    (mix): MixState | undefined => mix.state,
    undefined,
  );
}

/** The value of the «Мій Мікс» row of Settings; nothing until the Mix opens. */
export function useMixSummary(): string | undefined {
  const state = useMixState();
  const { count } = useEdition();
  return useMemo(
    () =>
      state === undefined
        ? undefined
        : mixSummary({ mix: state, strings: editionStrings.mix, count }),
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
  setCorrections: (inMix: boolean) => void;
} {
  const mix = useMix();
  const keep = (change: Promise<unknown> | undefined) => {
    change?.catch((error: unknown) => {
      console.error('Could not keep the change of the Mix', error);
    });
  };
  return {
    toggleCategory: (categoryId, inMix) => {
      keep(inMix ? mix?.putBack(categoryId) : mix?.takeOut(categoryId));
    },
    turnAllOn: () => {
      keep(mix?.turnAllOn());
    },
    setCorrections: (inMix) => {
      keep(mix?.setCorrections(inMix));
    },
  };
}
