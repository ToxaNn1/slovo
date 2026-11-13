import { Redirect } from 'expo-router';

import { useCorrectionCategories } from '@/categories/categories';
import { CategoryBoardScreen } from '@/categories/category-board';
import { useSegmentParam } from '@/route-params';

/**
 * A Category of Corrections' screen, from its tile in k2 (board 05.1, with
 * our Correction card). An id the Language Pack doesn't have, or
 * `correctionCategoryScreens` off, returns to the Dashboard.
 */
export default function CorrectionCategoryRoute() {
  const categoryId = useSegmentParam('categoryId');
  const categories = useCorrectionCategories();
  const place = categories.findIndex(({ id }) => id === categoryId);
  const category = categories[place];
  if (category === undefined) return <Redirect href="/" />;
  return <CategoryBoardScreen of="correction" category={category} place={place} />;
}
