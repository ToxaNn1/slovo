import type { HiddenEntries, HiddenEntry } from '@slovo/core';
import { fill, useEdition, useUndoToast } from '@slovo/ui';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { useComposition } from './composition';
import { editionStrings } from './edition';
import { hiddenScreenModel, hiddenSummary, type HiddenScreenModel } from './hidden-screen';
import { useMix, useMixState } from './mix';

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
        : hiddenScreenModel({ hiddenEntries: list, mix, strings: editionStrings }),
    [list, mix],
  );
}

/**
 * The calls of the Hidden screen. Bringing an Entry back shows the undo
 * toast, whose undo hides it again; a Category goes back in the Mix with no
 * toast. A change that could not be kept is logged and leaves things as they
 * were. Needs an `UndoToastProvider` above it.
 */
export function useHiddenChanges(): {
  restoreEntry: (entry: { entryId: string; title: string }) => void;
  turnCategoryOn: (categoryId: string) => void;
} {
  const hiddenEntries = useHiddenEntries();
  const mix = useMix();
  const showToast = useUndoToast();
  return {
    restoreEntry({ entryId, title }) {
      hiddenEntries
        ?.restore(entryId)
        .then(() => {
          showToast({
            message: fill(strings.entryRestored, { title }),
            undoLabel: strings.undo,
            onUndo() {
              hiddenEntries.hide(entryId).catch((error: unknown) => {
                console.error('Could not hide the Entry again', error);
              });
            },
          });
        })
        .catch((error: unknown) => {
          console.error('Could not restore the Hidden Entry', error);
        });
    },
    turnCategoryOn(categoryId) {
      mix?.putBack(categoryId).catch((error: unknown) => {
        console.error('Could not put the Category back in the Mix', error);
      });
    },
  };
}
