import type { Category } from '@slovo/contracts';

import { useComposition } from '../composition';
import { useSubscribed } from '../opening';

const none: readonly Category[] = [];

/**
 * The Categories of Words in the Language Pack's order, as the Dashboard's
 * Categories block holds them: none with `categoryScreens` off, so its rail,
 * k1 and a Category's screen draw nothing then (spec #1604).
 */
export function useCategories(): readonly Category[] {
  const { dashboard } = useComposition();
  return useSubscribed(
    dashboard,
    ({ blocks }) => blocks.find((block) => block.kind === 'categories')?.categories ?? none,
  );
}
