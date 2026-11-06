import type { AnyEntryCard, Composition } from '@slovo/core';
import { useUndoToast, type UndoToastContent } from '@slovo/ui';
import { useState } from 'react';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { keep } from '../keep';
import { useUndo, type Undo } from '../undo';
import { hideChoice, hideToast, type HideChoiceOption } from './hide-choice';

const { hiding: strings } = editionStrings;

/** What the hide choice sheet of `HideChoiceSheet` is given. */
export interface HideChoiceProps {
  readonly visible: boolean;
  readonly options: readonly {
    readonly key: string;
    readonly label: string;
    readonly disabledHint?: string;
  }[];
  readonly cancelLabel: string;
  readonly onChoose: (key: string) => void;
  readonly onCancel: () => void;
}

/**
 * The hide button's tap for one card, and the props of the hide choice sheet
 * it opens: «hide this Entry», on a Word card «hide its Category», on a
 * Correction card «hide its Category» and «hide Corrections», on an Idiom
 * card «hide Idioms», on a Synonym Row or a Tip card «hide» its kind (each
 * while the Edition in effect turns its kind on), and cancel. Hiding shows
 * the undo toast, whose undo restores the Entry or puts the Category or the
 * kind back in the Mix, in the composition open at the tap.
 * The Feed follows the Core at once: it drops the cards and puts them back on
 * undo. An Entry hidden already stays as it is, with nothing to undo.
 */
export function useHide(card: AnyEntryCard): { open: () => void; choice: HideChoiceProps } {
  const composition = useComposition();
  const undo = useUndo();
  const showToast = useUndoToast();
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<readonly HideChoiceOption[]>([]);

  return {
    open() {
      // Read when the sheet opens, so it follows every change of the Mix.
      setOptions(hideChoice({ card, mix: composition.mix, strings: editionStrings }));
      setVisible(true);
    },
    choice: {
      visible,
      options: options.map((option) => ({
        key: keyOf(option),
        label: option.label,
        ...(option.kind === 'last-category' && { disabledHint: option.disabledHint }),
      })),
      cancelLabel: strings.choice.cancel,
      onChoose(key) {
        // The sheet is still on screen while it slides out: a second tap hides nothing more.
        if (!visible) return;
        setVisible(false);
        const option = options.find((offered) => keyOf(offered) === key);
        if (option === undefined || option.kind === 'last-category') return;
        void keep('the hide from the card', hide(composition, option, showToast, undo));
      },
      onCancel() {
        setVisible(false);
      },
    },
  };
}

/** The sheet's key of an option: the last Category is offered in the place of a Category. */
function keyOf(option: HideChoiceOption): string {
  return option.kind === 'last-category' ? 'category' : option.kind;
}

/** Hides what the option names and shows its undo toast, unless nothing changed. */
async function hide(
  composition: Composition,
  option: Exclude<HideChoiceOption, { readonly kind: 'last-category' }>,
  showToast: (toast: UndoToastContent) => void,
  /** Runs the undo in the composition open at the tap (ADR 0018). */
  undo: (subject: string, undo: Undo) => void,
): Promise<void> {
  const result = await composition.hide(option.target);
  if (result === undefined) return;
  const message = hideToast({ option, changed: result.changed, strings });
  if (message === undefined) return;
  showToast({
    message,
    undoLabel: strings.undo,
    onUndo() {
      undo('the undo of the hide', result.undo);
    },
  });
}
