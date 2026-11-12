import { Redirect, useLocalSearchParams } from 'expo-router';

import { useCategories } from '@/categories/categories';
import { CategoryFeedScreen } from '@/categories/category-feed';
import { useShown } from '@/shown-in-effect';

/**
 * A Category's Feed, from a tap on a Word of its screen (ADR 0110), opened
 * on the Word `from`. An id the Language Pack doesn't have, or
 * `categoryFeed` off, returns to the Dashboard.
 */
export default function CategoryFeedRoute() {
  const { categoryId, from } = useLocalSearchParams<{ categoryId: string; from?: string }>();
  const category = useCategories().find(({ id }) => id === categoryId);
  const { categoryFeed } = useShown();
  if (category === undefined || !categoryFeed) return <Redirect href="/" />;
  return <CategoryFeedScreen category={category} from={from ?? ''} />;
}
