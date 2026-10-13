import { entryIdOf, type Composition, type EntryFeedCard } from '@slovo/core';
import { fill, useUndoToast, type UndoToastContent } from '@slovo/ui';
import { ActionSheetIOS } from 'react-native';

import { useComposition } from './composition';
import { edition, editionStrings } from './edition';
import { hideChoice, type HideOption } from './hide-choice';

const { hiding: strings } = editionStrings;

/**
 * The hide button's tap for one card: the hide choice, the system action
 * sheet with «hide this Entry», on a Word card «hide its Category», on a
 * Correction card «hide Corrections», and cancel. Hiding shows the undo
 * toast, whose undo restores the Entry or puts the Category or Corrections
 * back in the Mix. The Feed follows the Core at once: it drops the cards and
 * puts them back on undo. An Entry hidden already stays as it is, with
 * nothing to undo.
 */
export function useHide(card: EntryFeedCard): () => void {
  const composition = useComposition();
  const showToast = useUndoToast();
  const open = composition.status === 'ready' ? composition.composition : undefined;

  return () => {
    if (open === undefined) return;
    // Read when the sheet opens, so it follows every change of the Mix.
    const options = hideChoice({ card, mix: open.mix.state, edition, strings });
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...options.map(({ label }) => label), strings.choice.cancel],
        cancelButtonIndex: options.length,
      },
      (index) => {
        const option = options[index];
        if (option === undefined) return;
        hide(open, entryIdOf(card), option, showToast).catch((error: unknown) => {
          console.error('Could not hide from the card', error);
        });
      },
    );
  };
}

/** Hides what the option names and shows its undo toast. */
async function hide(
  open: Composition,
  entryId: string,
  option: HideOption,
  showToast: (toast: UndoToastContent) => void,
): Promise<void> {
  const { hiddenEntries, mix } = open;
  let message: string;
  let undo: () => Promise<unknown>;
  if (option.kind === 'entry') {
    if (hiddenEntries.has(entryId)) return;
    const row = await open.entryRow(entryId);
    if (row === undefined) return;
    await hiddenEntries.hide(entryId);
    message = fill(strings.entryHidden, { title: row.title });
    undo = () => hiddenEntries.restore(entryId);
  } else if (option.kind === 'category') {
    // Out already, or refused as the last Category in the Mix: the Mix
    // changed while the sheet was open.
    if (!mix.state.categoryIds.includes(option.categoryId)) return;
    if (!(await mix.takeOut(option.categoryId))) return;
    message = option.toast;
    undo = () => mix.putBack(option.categoryId);
  } else {
    if (!mix.state.corrections) return;
    await mix.setCorrections(false);
    message = option.toast;
    undo = () => mix.setCorrections(true);
  }
  showToast({
    message,
    undoLabel: strings.undo,
    onUndo() {
      undo().catch((error: unknown) => {
        console.error('Could not undo the hide', error);
      });
    },
  });
}
