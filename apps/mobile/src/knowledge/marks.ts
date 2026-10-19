import type { KnowledgeMark } from '@slovo/core';

import { useComposition } from '../composition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';

/** The mark an Entry's card shows, kept up to date, and the call a tap on a mark button makes. */
export function useKnowledgeMark(entryId: string): {
  mark: KnowledgeMark | undefined;
  tap: (mark: KnowledgeMark) => void;
} {
  const { knowledge } = useComposition();
  const mark = useSubscribed(knowledge, (open) => open.markOf(entryId));
  return {
    mark,
    tap: (tapped) => {
      void keep('the Knowledge Mark', knowledge.tap(entryId, tapped), undefined);
    },
  };
}
