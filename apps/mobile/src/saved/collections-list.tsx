import { UndoToastProvider } from '@slovo/ui';

import { CollectionsBoard } from '@/saved/collections-board';
import type { ListHeader } from '@/saved/list-header';

/**
 * Collections: the grid of board 09 (ADR 0132), under the toast that offers
 * the undo of a delete.
 */
export function CollectionsList({ header }: { header: ListHeader }) {
  return (
    <UndoToastProvider>
      <CollectionsBoard header={header} />
    </UndoToastProvider>
  );
}
