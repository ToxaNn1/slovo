import type { KnowledgeMark } from '@slovo/core';

import { useComposition } from '../composition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';

/**
 * The mark an Entry's card shows, read from the Knowledge snapshot and kept up
 * to date (none while the Entry is due, as its card is a Review), and the call
 * a tap on a mark button makes.
 */
export function useKnowledgeMark(entryId: string): {
  mark: KnowledgeMark | undefined;
  tap: (mark: KnowledgeMark) => void;
} {
  const { knowledge } = useComposition();
  const shown = useSubscribed(knowledge, (open) => open.state.shown.get(entryId));
  return {
    mark: shown === 'review' ? undefined : shown,
    tap: (tapped) => {
      void keep('the Knowledge Mark', knowledge.tap(entryId, tapped), undefined);
    },
  };
}
