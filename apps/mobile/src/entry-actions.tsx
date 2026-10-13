import { ActionRow, FavoriteButton } from '@slovo/ui';

import { useFavorite } from './favorites';

/**
 * The action row of an Entry card, wherever the card appears: the Feed and
 * the Entry screen a list opens. Each 0.3 action fills its own slot.
 */
export function EntryActions({ entryId }: { entryId: string }) {
  const favorite = useFavorite(entryId);
  return (
    <ActionRow
      favorite={<FavoriteButton inFavorites={favorite.inFavorites} onToggle={favorite.toggle} />}
    />
  );
}
