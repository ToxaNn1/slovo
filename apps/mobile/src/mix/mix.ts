import type { MixKindWeight, QuickQuestionEvery } from '@slovo/contracts';
import type { CategoryKind, Composition, MixKind, MixState } from '@slovo/core';
import { useEdition } from '@slovo/ui';
import { useMemo } from 'react';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { logError } from '../diagnostics/log';
import { useSubscribed } from '../opening';
import { mixScreenModel, mixSummary, type MixScreenModel } from './mix-screen';

/** The Mix as it stands, kept up to date. */
export function useMixState(): MixState {
  return useSubscribed(useComposition().mix, ({ state }) => state);
}

/** What the screens read of the Mix in effect, as it stands at one state. */
export type MixInEffect = Pick<Composition['mix'], 'screen' | 'outOfMix'>;

/** One view per state of the Mix, so it stays the same object until the Mix changes. */
const views = new WeakMap<MixState, MixInEffect>();

function inEffect(mix: Composition['mix']): MixInEffect {
  const { state } = mix;
  let view = views.get(state);
  if (view === undefined) {
    const screen = mix.screen();
    const outOfMix = mix.outOfMix();
    view = { screen: () => screen, outOfMix: () => outOfMix };
    views.set(state, view);
  }
  return view;
}

/** The Mix in effect as it stands, kept up to date: a new view after each change of the Mix. */
export function useMixInEffect(): MixInEffect {
  return useSubscribed(useComposition().mix, inEffect);
}

/** What the Mix screen draws, kept up to date. */
export function useMixScreenModel(): MixScreenModel {
  const mix = useMixInEffect();
  return useMemo(() => mixScreenModel({ mix }), [mix]);
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
  /** Puts the Category of the kind's list, the Words' unless given, in the Mix (`inMix`) or takes it out. */
  toggleCategory: (categoryId: string, inMix: boolean, of?: CategoryKind) => void;
  turnAllOn: () => void;
  /** Puts the kind of Entry (Corrections, Idioms, Synonym Rows, Tips) as a whole in the Mix (`inMix`) or takes it out. */
  setKind: (kind: MixKind, inMix: boolean) => void;
  /** Sets the Mix kind weight of the kind: «Менше», «Звичайно» or «Більше». */
  setKindWeight: (kind: MixKind, weight: MixKindWeight) => void;
  /** Sets how often the Feed asks a Quick Question. */
  setQuickQuestionEvery: (every: QuickQuestionEvery) => void;
} {
  const { mix } = useComposition();
  const keep = (change: Promise<unknown>) => {
    change.catch((error: unknown) => {
      logError('Could not keep the change of the Mix', error);
    });
  };
  return {
    toggleCategory: (categoryId, inMix, of) => {
      keep(mix.setCategory(categoryId, inMix, of));
    },
    turnAllOn: () => {
      keep(mix.turnAllOn());
    },
    setKind: (kind, inMix) => {
      keep(mix.setKind(kind, inMix));
    },
    setKindWeight: (kind, weight) => {
      keep(mix.setKindWeight(kind, weight));
    },
    setQuickQuestionEvery: (every) => {
      keep(mix.setQuickQuestionEvery(every));
    },
  };
}
