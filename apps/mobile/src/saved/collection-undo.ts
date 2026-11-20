import type { DeletedCollection } from '@slovo/core';
import { useUndoToast } from '@slovo/ui';
import { useCallback, useEffect } from 'react';

import { editionStrings } from '../edition/edition';
import { keep } from '../keep';
import { useOpenScreen } from '../use-open-screen';

const { toasts } = editionStrings.collections;

/** The undo of a delete still to be offered, and whether its undo opens the Collection again. */
interface Offer {
  readonly deleted: DeletedCollection;
  readonly reopen: boolean;
}

/** The one undo a Collection's screen hands to the grid as it leaves; the grid takes it. */
let handed: Offer | undefined;
const listeners = new Set<() => void>();

/**
 * Hands the undo of a Collection deleted on its own screen to the Collections
 * grid, which shows the toast once it is in front; its undo opens
 * the Collection again.
 */
export function handDeleteUndo(deleted: DeletedCollection): void {
  handed = { deleted, reopen: true };
  for (const listener of listeners) listener();
}

/**
 * Takes the handed undo, once. It lives outside the hook on purpose: inside
 * it, the React Compiler read `handed` again after clearing it, in place of
 * the copy taken before.
 */
function takeHanded(): Offer | undefined {
  const offer = handed;
  handed = undefined;
  return offer;
}

/**
 * The toast «Колекцію видалено.» with «Скасувати» (board 09): the undo
 * brings the Collection back through the Collection store, and opens it again
 * when it was deleted on its own screen. It needs an `UndoToastProvider`
 * above it.
 */
export function useDeleteUndoToast(): (deleted: DeletedCollection, reopen?: boolean) => void {
  const showToast = useUndoToast();
  const openScreen = useOpenScreen();
  return useCallback(
    (deleted, reopen = false) => {
      showToast({
        look: 'plate',
        message: toasts.deleted,
        action: {
          label: toasts.undo,
          onPress: () => {
            void keep('Collections', deleted.restore()).then((back) => {
              if (back !== undefined && reopen) openScreen(`/saved/collections/${back.id}`);
            });
          },
        },
      });
    },
    [showToast, openScreen],
  );
}

/** Shows the toast of an undo a Collection's screen handed over, now and whenever one is handed. */
export function useHandedDeleteUndo(): void {
  const showUndo = useDeleteUndoToast();
  useEffect(() => {
    const take = () => {
      const offer = takeHanded();
      if (offer === undefined) return;
      showUndo(offer.deleted, offer.reopen);
    };
    take();
    listeners.add(take);
    return () => {
      listeners.delete(take);
    };
  }, [showUndo]);
}
