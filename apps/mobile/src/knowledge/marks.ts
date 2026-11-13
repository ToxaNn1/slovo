import type { EntryRowModel, KnowledgeMark } from '@slovo/core';
import type { RailBoardCard } from '@slovo/ui';
import { useMemo } from 'react';

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

/**
 * A rail board's card per row, each with whether its Entry is Known for the
 * «ЗНАЮ» stamp; built again only when the rows or the Knowledge Marks change.
 */
export function useKnownCards(
  rows: readonly { readonly entryId: string; readonly row: EntryRowModel }[] | undefined,
): readonly RailBoardCard[] | undefined {
  const { knowledge } = useComposition();
  // A Knowledge Mark makes a new state, which builds the cards again.
  const state = useSubscribed(knowledge, (open) => open.state);
  return useMemo(
    () => rows?.map(({ entryId, row }) => ({ entryId, row, known: knowledge.isKnown(entryId) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `isKnown` reads `state`.
    [rows, knowledge, state],
  );
}
