import type { Category } from '@slovo/contracts';
import type { CategoryKind } from '@slovo/core';
import { toneByPosition, type CategoryTone } from '@slovo/ui';

import { useComposition } from '../composition';
import { useEditionInEffect } from '../edition/remote-switches';
import { useSubscribed } from '../opening';

const none: readonly Category[] = [];

/** The Dashboard block that holds the Categories of each kind. */
const blockOf = { word: 'categories', correction: 'correctionTypes' } as const;

/**
 * The Categories of Words, or of Corrections, in the Language Pack's order,
 * as the Dashboard's Categories block, or its Correction Types block, holds
 * them: none with `categoryScreens`, or `correctionCategoryScreens`, off, so
 * its rail, k1 or k2 and a Category's screen draw nothing then (spec #1604).
 */
export function useBlockCategories(of: CategoryKind): readonly Category[] {
  const { dashboard } = useComposition();
  return useSubscribed(
    dashboard,
    ({ blocks }) => blocks.find((block) => block.kind === blockOf[of])?.categories ?? none,
  );
}

/**
 * Whether a Category draws quiet, its k3 screen and quiet tile: its tone is
 * `quiet` and the Edition in effect has `quietCategories` on; off, it draws
 * loud (ADR 0081).
 */
export function useIsQuiet(): (category: Category) => boolean {
  const quiet = useEditionInEffect().isFeatureEnabled('quietCategories');
  return (category) => quiet && category.tone === 'quiet';
}

/**
 * The tones of a row of Category tiles: the boards' tones by position, and
 * `quietTone` for a quiet Category's tile (k1's or the rail's).
 */
export function useTonesOf(
  quietTone: Extract<CategoryTone, 'quietGrid' | 'quietRail'>,
): (categories: readonly Category[]) => (index: number) => CategoryTone {
  const isQuiet = useIsQuiet();
  return (categories) => (index) => {
    const category = categories[index];
    return category !== undefined && isQuiet(category) ? quietTone : toneByPosition(index);
  };
}
