import { useLocalSearchParams } from 'expo-router';

import { editionStrings } from '../../../edition';
import { EntryScreen } from '../../../entry-screen';

/** An Entry opened from Favorites. */
export default function FavoriteEntryScreen() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  return <EntryScreen entryId={entryId} back={editionStrings.favorites.title} />;
}
