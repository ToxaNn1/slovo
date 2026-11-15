import { fill, type Category } from '@slovo/contracts';
import {
  buildEntryRow,
  categoryPlace,
  type CategoryKind,
  type CategoryPlace,
  type Composition,
} from '@slovo/core';
import { useUndoToast, type RailBoardCard } from '@slovo/ui';
import { useCallback, useMemo, useState } from 'react';

import { useComposition, useCompositionRead } from '../composition';
import { keep } from '../keep';
import { editionStrings } from '../edition/edition';
import { useKnownCards } from '../knowledge/marks';
import { useMixState } from '../mix/mix';
import { useShown } from '../shown-in-effect';
import { useOpenScreen } from '../use-open-screen';

const { toasts } = editionStrings.dashboard.category;
/** What the Mix screen says under a list whose last Category can't be taken out (ADR 0019). */
const lastCategoryHint: Record<CategoryKind, string> = {
  word: editionStrings.mix.lastCategoryHint,
  correction: editionStrings.mix.corrections.lastCategoryHint,
};

/** What a Category's screen draws and does. */
export interface CategoryScreen {
  /**
   * A card per live Entry of the Category, in the Language Pack's order, the
   * Known ones first while `categoryKnownFirst` is on (ADR 0111);
   * `undefined` till the first read ends, so nothing counts the Entries before.
   */
  readonly cards: readonly RailBoardCard[] | undefined;
  /** Set once the read failed: reads the Entries again. */
  readonly retry: (() => void) | undefined;
  /** Whether the Category is in the Mix, which reads «У МІКСІ». */
  readonly inMix: boolean;
  /**
   * Puts the Category in the Mix or takes it out, and says so in a toast; the
   * last Category of its list stays in, with the Mix screen's reason why.
   */
  readonly toggleMix: () => void;
  /**
   * Opens a Word in the Category's Feed while `categoryFeed` is on (ADR 0110),
   * else an Entry's card as Search does; neither makes anything Seen (ADR 0076).
   */
  readonly openEntry: (entryId: string) => void;
}

/**
 * A Category's screen, of the Words' or the Corrections' list: its live
 * Entries as cards, their «ЗНАЮ» following each Knowledge Mark, and its place in the
 * Mix through the Core Mix. Must sit under an `UndoToastProvider`.
 */
export function useCategoryScreen(of: CategoryKind, category: Category): CategoryScreen {
  const { mix } = useComposition();
  const mixState = useMixState();
  const showToast = useUndoToast();
  const openScreen = useOpenScreen();
  const { categoryFeed, categoryKnownFirst } = useShown();
  const read = useCallback(
    async (open: Composition) =>
      (await open.categoryEntries(of, category.id)).map((entry) => {
        const row = buildEntryRow(entry);
        return { entryId: row.entryId, row };
      }),
    [of, category.id],
  );
  const reading = useCompositionRead(read, 'Could not read the Entries of a Category');
  const cards = useKnownCards(reading.status === 'ready' ? reading.value : undefined);
  const listed = useMemo(
    () =>
      cards && categoryKnownFirst
        ? [...cards.filter((card) => card.known), ...cards.filter((card) => !card.known)]
        : cards,
    [cards, categoryKnownFirst],
  );
  const place: CategoryPlace = categoryPlace(mixState, of, category.id);
  // The reader's choice shows at once: the Mix keeps it only once the Cycle has read the
  // eligible Entries again, which takes seconds on a large Edition (owner 15.11).
  const [chosen, setChosen] = useState<boolean>();
  const inMix = chosen ?? (place === 'in' || place === 'last');
  const name = category.displayName;
  return {
    cards: listed,
    retry: reading.status === 'failed' ? reading.retry : undefined,
    inMix,
    toggleMix: () => {
      // The last Category of its list stays in, with the Mix screen's reason why.
      if (chosen === undefined && place === 'last') {
        showToast({ message: lastCategoryHint[of] });
        return;
      }
      const want = !inMix;
      setChosen(want);
      showToast({ message: fill(want ? toasts.added : toasts.removed, { name }), brief: true });
      // A later tap's choice, still on its way, stays shown.
      void keep('the Mix', mix.setCategory(category.id, want, of)).then(() => {
        setChosen((now) => (now === want ? undefined : now));
      });
    },
    // The Entry route of Search opens the card through `entryCard`, with the way back named.
    openEntry: (entryId) => {
      if (of === 'word' && categoryFeed) {
        openScreen(`/category-feed/${category.id}?from=${encodeURIComponent(entryId)}`);
        return;
      }
      openScreen(`/search/${entryId}?back=${encodeURIComponent(name)}`);
    },
  };
}
