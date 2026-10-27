import type { CategoryKind, HiddenEntry, HideTarget, MixKind } from '@slovo/core';
import { fill, useEdition, useUndoToast } from '@slovo/ui';
import { useMemo } from 'react';

import { compositionOpening, useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { useEditionInEffect } from '../edition/remote-switches';
import { logError } from '../diagnostics/log';
import { useSubscribed } from '../opening';
import { hiddenScreenModel, hiddenSummary, type HiddenScreenModel } from './hidden-screen';
import { undoRestore } from './hiding-undo';
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
  const showToast = useUndoToast();

  function unhide(target: HideTarget): void {
    composition.unhide(target).then(
      (result) => {
        if (result?.changed.kind !== 'entry' || result.hiddenAt === undefined) return;
        const { hiddenAt } = result;
        const { entryId } = result.changed;
        showToast({
          message: fill(strings.entryRestored, { title: result.changed.row.title }),
          undoLabel: strings.undo,
          onUndo() {
            compositionOpening
              .opened()
              .then((current) => undoRestore(current, entryId, hiddenAt))
              .catch((error: unknown) => {
                logError('Could not hide the Entry again', error);
              });
          },
        });
      },
      (error: unknown) => {
        logError('Could not bring the hidden change back', error);
      },
    );
  }

  return {
    restoreEntry: (entryId) => {
      unhide({ kind: 'entry', entryId });
    },
    turnCategoryOn: (categoryId, of) => {
      unhide(
        of === 'word' ? { kind: 'category', categoryId } : { kind: 'category', categoryId, of },
      );
    },
    turnKindOn: (entryKind) => {
      unhide({ kind: 'whole-kind', entryKind });
    },
  };
}
