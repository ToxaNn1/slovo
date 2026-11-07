import {
  categoryTarget,
  type CategoryKind,
  type HiddenEntry,
  type HideTarget,
  type MixKind,
} from '@slovo/core';
import { fill, useEdition, useUndoToast } from '@slovo/ui';
import { useMemo } from 'react';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';
import { useUndo } from '../undo';
import { hiddenScreenModel, hiddenSummary, type HiddenScreenModel } from './hidden-screen';
import { useMixInEffect } from './mix';

const strings = editionStrings.hidden;

/** The Hidden Entries, newest first, kept up to date. */
function useHiddenList(): readonly HiddenEntry[] {
  return useSubscribed(useComposition().hiddenEntries, ({ list }) => list);
}

/** The value of the «Приховані записи» row of Settings: how many Entries are hidden. */
export function useHiddenSummary(): string {
  const list = useHiddenList();
  const { count } = useEdition();
  return useMemo(() => hiddenSummary({ hiddenEntries: list, strings, count }), [list, count]);
}

/** What the Hidden screen draws, kept up to date. */
export function useHiddenScreenModel(): HiddenScreenModel {
  const list = useHiddenList();
  const { outOfMix, kindsOn } = useMixInEffect();
  return useMemo(
    () => hiddenScreenModel({ hiddenEntries: list, outOfMix, kindsOn, strings: editionStrings }),
    [list, outOfMix, kindsOn],
  );
}

/**
 * The calls of the Hidden screen, each an unhide of the Core composition.
 * Bringing an Entry back shows the undo toast, which hides it again at the
 * time the composition returns, in the composition open at the tap, so the
 * Entry goes back to its old place in the list; a Category, Corrections or
 * Idioms go back in the Mix with no toast. A change that could not be kept is
 * logged and leaves things as they were. Needs an `UndoToastProvider` above it.
 */
export function useHiddenChanges(): {
  restoreEntry: (entryId: string) => void;
  /** Puts the Category of the list, the Words' or the Corrections', back in the Mix. */
  turnCategoryOn: (categoryId: string, of: CategoryKind) => void;
  /** Puts the kind of Entry (Corrections, Idioms, Synonym Rows, Tips) as a whole back in the Mix. */
  turnKindOn: (entryKind: MixKind) => void;
} {
  const composition = useComposition();
  const undo = useUndo();
  const showToast = useUndoToast();

  function unhide(target: HideTarget): void {
    void keep('the hidden change', composition.unhide(target)).then((result) => {
      if (result?.changed.kind !== 'entry' || result.undo === undefined) return;
      const { undo: restoreUndo } = result;
      showToast({
        message: fill(strings.entryRestored, { title: result.changed.row.title }),
        undoLabel: strings.undo,
        onUndo() {
          undo('the undo of bringing the Entry back', restoreUndo);
        },
      });
    });
  }

  return {
    restoreEntry: (entryId) => {
      unhide({ kind: 'entry', entryId });
    },
    turnCategoryOn: (categoryId, of) => {
      unhide(categoryTarget(categoryId, of));
    },
    turnKindOn: (entryKind) => {
      unhide({ kind: 'whole-kind', entryKind });
    },
  };
}
