import { useLocalSearchParams } from 'expo-router';

import { editionStrings } from '../../../edition';
import { EntryScreen } from '../../../entry-screen';

/** An Entry opened from Favorites, or a Correction opened from a Word's Entry screen there. */
export default function FavoriteEntryScreen() {
  const { entryId, back } = useLocalSearchParams<{ entryId: string; back?: string }>();
  return (
    <EntryScreen
      entryId={entryId}
      back={back ?? editionStrings.favorites.title}
      route="/saved/favorites"
    />
  );
}
