import { ScreenStack } from '@/entries/screen-stack';

/**
 * The Saved tab's own stack: the overview, Favorites, Collections → a Collection,
 * and History, each list with the Entry screen its rows open.
 */
export default function SavedLayout() {
  return <ScreenStack />;
}
