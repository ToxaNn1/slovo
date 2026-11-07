import type { KnowledgeMark } from '@slovo/core';

import { useComposition } from '../composition';
import { keep } from '../keep';
import { useSubscribed } from '../opening';
import { useUndo } from '../undo';

/**
 * The mark an Entry's card shows, read from the Knowledge snapshot and kept up
 * to date (none while the Entry is due, as its card is a Review), and the call
 * a tap on a mark button makes, and the calls a swipe and the card's «⋯»
 * menu make (ADR 0077).
 */
export function useKnowledgeMark(entryId: string): {
  mark: KnowledgeMark | undefined;
  tap: (mark: KnowledgeMark) => void;
  set: (mark: KnowledgeMark) => void;
  clear: () => void;
  undo: () => void;
} {
  const { knowledge } = useComposition();
  const undo = useUndo();
  const shown = useSubscribed(knowledge, (open) => open.state.shown.get(entryId));
  return {
    mark: shown === 'review' ? undefined : shown,
    tap: (tapped) => {
      void keep('the Knowledge Mark', knowledge.tap(entryId, tapped));
    },
    set: (mark) => {
      void keep('the Knowledge Mark', knowledge.set(entryId, mark));
    },
    clear: () => {
      void keep('the Knowledge Mark', knowledge.clear(entryId));
    },
    undo: () => {
      undo('the Knowledge Mark', (open) => open.knowledge.undo());
    },
  };
}
