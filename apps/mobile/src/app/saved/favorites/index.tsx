import { editionStrings } from '@/edition/edition';
import { useFavoriteList } from '@/saved/favorites';
import { FavoritesList } from '@/saved/favorites-list';
import { SavedListScreen } from '@/saved/saved-list-screen';

const { favorites: strings } = editionStrings;

/** Favorites on their own screen: a back link to Saved, the title with how many Entries it holds, then the list. */
export default function FavoritesScreen() {
  const list = useFavoriteList();
  return (
    <SavedListScreen
      name="favorites"
      title={strings.title}
      aside={{ kind: 'count', value: list.length, forms: strings.count }}
      list={(header) => <FavoritesList header={header} />}
    />
  );
}
