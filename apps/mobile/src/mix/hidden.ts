import type { HiddenEntry, HideTarget } from '@slovo/core';
import { fill, useEdition, useUndoToast } from '@slovo/ui';
import { useMemo } from 'react';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useSubscribed } from '../opening';
import { hiddenScreenModel, hiddenSummary, type HiddenScreenModel } from './hidden-screen';
import { useMixState } from './mix';

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
  const mix = useMixState();
  const edition = useEditionInEffect();
  return useMemo(
    () => hiddenScreenModel({ edition, hiddenEntries: list, mix, strings: editionStrings }),
    [edition, list, mix],
  );
}

/**
 * The calls of the Hidden screen, each an unhide of the Core composition.
 * Bringing an Entry back shows the undo toast, which calls the undo the
 * composition returns, so the Entry goes back to its old place in the list; a Category or Corrections
 * goes back in the Mix with no toast. A change that could not be kept is
 * logged and leaves things as they were. Needs an `UndoToastProvider` above it.
 */
export function useHiddenChanges(): {
  restoreEntry: (entryId: string) => void;
  turnCategoryOn: (categoryId: string) => void;
  turnCorrectionsOn: () => void;
} {
  const composition = useComposition();
  const showToast = useUndoToast();

  function unhide(target: HideTarget): void {
    composition.unhide(target).then(
      (result) => {
        if (result?.changed.kind !== 'entry' || result.undo === undefined) return;
        const { undo } = result;
        showToast({
          message: fill(strings.entryRestored, { title: result.changed.row.title }),
          undoLabel: strings.undo,
          onUndo() {
            undo().catch((error: unknown) => {
              console.error('Could not hide the Entry again', error);
            });
          },
        });
      },
      (error: unknown) => {
        console.error('Could not bring the hidden change back', error);
      },
    );
  }

  return {
    restoreEntry: (entryId) => {
      unhide({ kind: 'entry', entryId });
    },
    turnCategoryOn: (categoryId) => {
      unhide({ kind: 'category', categoryId });
    },
    turnCorrectionsOn: () => {
      unhide({ kind: 'corrections' });
    },
  };
}
