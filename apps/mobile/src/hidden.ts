import type { HiddenEntries, HiddenEntry, HideTarget } from '@slovo/core';
import { fill, useEdition, useUndoToast } from '@slovo/ui';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { useComposition } from './composition';
import { edition, editionStrings } from './edition';
import { hiddenScreenModel, hiddenSummary, type HiddenScreenModel } from './hidden-screen';
import { useMixState } from './mix';

const strings = editionStrings.hidden;

const noHiddenEntries: readonly HiddenEntry[] = [];

/** The Hidden Entries of the session's Core composition, once it is open. */
function useHiddenEntries(): HiddenEntries | undefined {
  const composition = useComposition();
  return composition.status === 'ready' ? composition.composition.hiddenEntries : undefined;
}

/** The Hidden Entries, newest first, kept up to date; none until they open. */
function useHiddenList(): readonly HiddenEntry[] {
  const hiddenEntries = useHiddenEntries();
  const subscribe = useCallback(
    (listener: () => void) => hiddenEntries?.subscribe(listener) ?? (() => undefined),
    [hiddenEntries],
  );
  return useSyncExternalStore(subscribe, () => hiddenEntries?.list ?? noHiddenEntries);
}

/** The value of the «Приховані записи» row of Settings: how many Entries are hidden. */
export function useHiddenSummary(): string | undefined {
  const composition = useComposition();
  const list = useHiddenList();
  const { count } = useEdition();
  return useMemo(
    () =>
      composition.status === 'ready'
        ? hiddenSummary({ hiddenEntries: list, strings, count })
        : undefined,
    [composition.status, list, count],
  );
}

/** What the Hidden screen draws, kept up to date; nothing until the Core composition opens. */
export function useHiddenScreenModel(): HiddenScreenModel | undefined {
  const list = useHiddenList();
  const mix = useMixState();
  return useMemo(
    () =>
      mix === undefined
        ? undefined
        : hiddenScreenModel({ edition, hiddenEntries: list, mix, strings: editionStrings }),
    [list, mix],
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
  const open = composition.status === 'ready' ? composition.composition : undefined;

  function unhide(target: HideTarget): void {
    open?.unhide(target).then(
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
