import { withoutStress, type CollectionEntry } from '@slovo/core';

import { entryLabelBeside } from '../entries/entry-row-text';
import { EntryRow } from '../entries/EntryRow';
import { fill, useEdition } from '../providers/EditionProvider';

/**
 * An Entry of a Collection: the Entry with its kind and when it was added on
 * the right. A tap opens the Entry; a swipe (or the VoiceOver action) takes it
 * out of this Collection only. Needs a `GestureHandlerRootView` above it.
 */
export function CollectionEntryRow({
  entry: { row },
  added,
  collectionName,
  onPress,
  onRemove,
}: {
  entry: CollectionEntry;
  /** When the Entry was added, as the row says it: «сьогодні», «12 жовт.». */
  added: string;
  collectionName: string;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { strings } = useEdition();
  const { entries } = strings.collections;
  return (
    <EntryRow
      row={row}
      trailing={entryLabelBeside(strings.history, row, added)}
      onPress={onPress}
      actions={[
        {
          name: 'remove',
          label: entries.remove,
          accessibilityLabel: fill(entries.removeLabel, {
            title: withoutStress(row.title),
            name: collectionName,
          }),
          tone: 'destructive',
          onPress: onRemove,
        },
      ]}
    />
  );
}
