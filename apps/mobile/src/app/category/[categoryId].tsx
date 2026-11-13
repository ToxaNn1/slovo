import { Redirect } from 'expo-router';

import { CategoryBoardScreen } from '@/categories/category-board';
import { useCategories } from '@/categories/categories';
import { useSegmentParam } from '@/route-params';

/**
 * A Category of Words' screen, from its tile on the rail or in k1 (board
 * 05.1). An id the Language Pack doesn't have, or `categoryScreens` off,
 * returns to the Dashboard.
 */
export default function CategoryRoute() {
  const categoryId = useSegmentParam('categoryId');
  const categories = useCategories();
  const place = categories.findIndex(({ id }) => id === categoryId);
  const category = categories[place];
  if (category === undefined) return <Redirect href="/" />;
  return <CategoryBoardScreen of="word" category={category} place={place} />;
}
