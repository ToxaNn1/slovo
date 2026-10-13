import { fill, useUndoToast } from '@slovo/ui';
import { ActionSheetIOS } from 'react-native';

import { useComposition } from './composition';
import { editionStrings } from './edition';

const { hiding: strings } = editionStrings;

/**
 * The hide button's tap for one Entry: the hide choice, the system action
 * sheet with «hide this Entry» and cancel. Hiding it shows the undo toast,
 * whose undo restores the Entry. The Feed follows the Core at once: it drops
 * the card and puts it back on undo. An Entry hidden already stays as it is,
 * with nothing to undo.
 */
export function useHideEntry(entryId: string): () => void {
  const composition = useComposition();
  const showToast = useUndoToast();
  const open = composition.status === 'ready' ? composition.composition : undefined;

  async function hide(): Promise<void> {
    if (open === undefined) return;
    const { hiddenEntries } = open;
    if (hiddenEntries.has(entryId)) return;
    const row = await open.entryRow(entryId);
    if (row === undefined) return;
    await hiddenEntries.hide(entryId);
    showToast({
      message: fill(strings.entryHidden, { title: row.title }),
      undoLabel: strings.undo,
      onUndo() {
        hiddenEntries.restore(entryId).catch((error: unknown) => {
          console.error('Could not restore the Hidden Entry', error);
        });
      },
    });
  }

  return () => {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [strings.choice.entry, strings.choice.cancel], cancelButtonIndex: 1 },
      (index) => {
        if (index !== 0) return;
        hide().catch((error: unknown) => {
          console.error('Could not hide the Entry', error);
        });
      },
    );
  };
}
