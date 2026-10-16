import type { Composition, EntryFeedCard } from '@slovo/core';
import { useUndoToast, type UndoToastContent } from '@slovo/ui';
import { ActionSheetIOS } from 'react-native';

import { useComposition } from '../composition';
import { edition, editionStrings } from '../edition/edition';
import { hideChoice, hideToast, type HideOption } from './hide-choice';

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
        hide(open, option, showToast).catch((error: unknown) => {
          console.error('Could not hide from the card', error);
        });
      },
    );
  };
}

/** Hides what the option names and shows its undo toast, unless nothing changed. */
async function hide(
  open: Composition,
  option: HideOption,
  showToast: (toast: UndoToastContent) => void,
): Promise<void> {
  const result = await open.hide(option.target);
  if (result === undefined) return;
  const message = hideToast({ option, changed: result.changed, strings });
  if (message === undefined) return;
  showToast({
    message,
    undoLabel: strings.undo,
    onUndo() {
      result.undo().catch((error: unknown) => {
        console.error('Could not undo the hide', error);
      });
    },
  });
}
