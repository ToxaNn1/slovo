import type { HiddenEntry } from '@slovo/core';
import { fill, useEdition, useUndoToast } from '@slovo/ui';
import { useMemo } from 'react';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';
import { useUndo } from '../undo';
import {
  hiddenScreenModel,
  hiddenSummary,
  type HiddenRowModel,
  type HiddenScreenModel,
} from './hidden-screen';
import { useMixInEffect } from './mix';

const strings = editionStrings.hidden;

/** The Hidden Entries, newest first, kept up to date. */
function useHiddenList(): readonly HiddenEntry[] {
  return useSubscribed(useComposition().hiddenEntries, ({ list }) => list);
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
 * The value of «Приховане» of «Мої Теми» and «Приховані записи» of Settings,
 * from the Hidden screen's own rows, kept up to date with them.
 */
export function useHiddenSummary(): string {
  const { rows } = useHiddenScreenModel();
  const { count } = useEdition();
  return useMemo(() => hiddenSummary({ rows, strings, count }), [rows, count]);
}

/**
 * The one call of the Hidden screen, «Показати»: the unhide of the Core
 * composition for the row's kind, which restores the Entry or puts the
 * Category or the kind back in the Mix. Each shows the undo toast, which
 * hides it again at the time the composition returns, in the composition
 * open at the tap, so it goes back to its old place in the list. A change
 * that could not be kept is logged and leaves things as they were. Needs an
 * `UndoToastProvider` above it.
 */
export function useHiddenShow(): (row: HiddenRowModel) => void {
  const composition = useComposition();
  const undo = useUndo();
  const showToast = useUndoToast();

  return ({ target, name }) => {
    void keep('the hidden change', composition.unhide(target)).then((result) => {
      if (result === undefined) return;
      const { undo: showUndo } = result;
      showToast({
        message: fill(strings.entryRestored, { title: name }),
        undoLabel: strings.undo,
        onUndo() {
          undo('the undo of showing what was hidden', showUndo);
        },
      });
    });
  };
}
