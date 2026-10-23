import type { Composition, EntryFeedCard } from '@slovo/core';
import { useUndoToast, type UndoToastContent } from '@slovo/ui';
import { useState } from 'react';

import { compositionOpening, useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { hideChoice, hideToast, type HideOption } from './hide-choice';
import { undoHide } from './hiding-undo';

const { hiding: strings } = editionStrings;

/** What the hide choice sheet of `HideChoiceSheet` is given. */
export interface HideChoiceProps {
  readonly visible: boolean;
  readonly options: readonly { readonly key: string; readonly label: string }[];
  readonly cancelLabel: string;
  readonly onChoose: (key: string) => void;
  readonly onCancel: () => void;
}

/**
 * The hide button's tap for one card, and the props of the hide choice sheet
 * it opens: «hide this Entry», on a Word card «hide its Category», on a
 * Correction card «hide Corrections», on an Idiom card «hide Idioms», and
 * cancel. Hiding shows the undo toast, whose undo restores the Entry or puts
 * the Category, Corrections or Idioms
 * back in the Mix, in the composition open at the tap. The Feed follows the Core at once: it drops the cards and
 * puts them back on undo. An Entry hidden already stays as it is, with
 * nothing to undo.
 */
export function useHide(card: EntryFeedCard): { open: () => void; choice: HideChoiceProps } {
  const composition = useComposition();
  const showToast = useUndoToast();
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<readonly HideOption[]>([]);

  return {
    open() {
      // Read when the sheet opens, so it follows every change of the Mix.
      setOptions(hideChoice({ card, mix: composition.mix.state, strings }));
      setVisible(true);
    },
    choice: {
      visible,
      options: options.map(({ kind, label }) => ({ key: kind, label })),
      cancelLabel: strings.choice.cancel,
      onChoose(key) {
        // The sheet is still on screen while it slides out: a second tap hides nothing more.
        if (!visible) return;
        setVisible(false);
        const option = options.find(({ kind }) => kind === key);
        if (option === undefined) return;
        hide(composition, option, showToast).catch((error: unknown) => {
          console.error('Could not hide from the card', error);
        });
      },
      onCancel() {
        setVisible(false);
      },
    },
  };
}

/** Hides what the option names and shows its undo toast, unless nothing changed. */
async function hide(
  composition: Composition,
  option: HideOption,
  showToast: (toast: UndoToastContent) => void,
): Promise<void> {
  const result = await composition.hide(option.target);
  if (result === undefined) return;
  const message = hideToast({ option, changed: result.changed, strings });
  if (message === undefined) return;
  showToast({
    message,
    undoLabel: strings.undo,
    onUndo() {
      compositionOpening
        .opened()
        .then((current) => undoHide(current, result.changed))
        .catch((error: unknown) => {
          console.error('Could not undo the hide', error);
        });
    },
  });
}
