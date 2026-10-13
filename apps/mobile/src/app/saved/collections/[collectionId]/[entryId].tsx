import { useLocalSearchParams } from 'expo-router';

import { useCollectionList } from '../../../../collections';
import { editionStrings } from '../../../../edition';
import { EntryScreen } from '../../../../entry-screen';

/** An Entry opened from a Collection, or a Correction opened from a Word's Entry screen there. */
export default function CollectionEntryScreen() {
  const { collectionId, entryId, back } = useLocalSearchParams<{
    collectionId: string;
    entryId: string;
    back?: string;
  }>();
  const collection = useCollectionList().find(({ id }) => id === collectionId);
  return (
    <EntryScreen
      entryId={entryId}
      back={back ?? collection?.name ?? editionStrings.collections.title}
      route={`/saved/collections/${collectionId}`}
    />
  );
}
