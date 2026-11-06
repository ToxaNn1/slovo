import { fill, type Category } from '@slovo/contracts';
import {
  buildEntryRow,
  categoryPlace,
  type CategoryKind,
  type CategoryPlace,
  type Composition,
  type EntryRowModel,
} from '@slovo/core';
import { useUndoToast, type RailBoardCard } from '@slovo/ui';
import { useEffect, useState } from 'react';

import { useComposition } from '../composition';
import { logError } from '../diagnostics/log';
import { keep } from '../keep';
import { editionStrings } from '../edition/edition';
import { useMixState } from '../mix/mix';
import { useSubscribed } from '../opening';
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
   * A card per live Entry of the Category, in the Language Pack's order;
   * `undefined` till the first read ends, so nothing counts the Entries before.
   */
  readonly cards: readonly RailBoardCard[] | undefined;
  /** Whether the Category is in the Mix, which reads «У МІКСІ». */
  readonly inMix: boolean;
  /**
   * Puts the Category in the Mix or takes it out, and says so in a toast; the
   * last Category of its list stays in, with the Mix screen's reason why.
   */
  readonly toggleMix: () => void;
  /** Opens an Entry's card as Search does, which makes nothing Seen (ADR 0076). */
  readonly openEntry: (entryId: string) => void;
}

/**
 * A Category's screen, of the Words' or the Corrections' list: its live
 * Entries as cards, read again on each Knowledge Mark, and its place in the
 * Mix through the Core Mix. Must sit under an `UndoToastProvider`.
 */
export function useCategoryScreen(of: CategoryKind, category: Category): CategoryScreen {
  const composition = useComposition();
  const { knowledge, mix } = composition;
  // Read again on every Knowledge Mark, so «ЗНАЮ» and the stamps follow at once.
  useSubscribed(knowledge, (open) => open.state);
  const mixState = useMixState();
  const showToast = useUndoToast();
  const openScreen = useOpenScreen();
  const [read, setRead] = useState<{
    in: Composition;
    key: string;
    rows: readonly EntryRowModel[];
  }>();
  const key = `${of}:${category.id}`;
  useEffect(() => {
    let active = true;
    composition.categoryEntries(of, category.id).then(
      (entries) => {
        if (active)
          setRead({
            in: composition,
            key,
            rows: entries.map(buildEntryRow),
          });
      },
      (error: unknown) => {
        logError('Could not read the Entries of a Category', error);
      },
    );
    return () => {
      active = false;
    };
  }, [composition, of, category.id, key]);

  // A read of a composition since reopened, or of another Category, is not shown.
  const rows = read?.in === composition && read.key === key ? read.rows : undefined;
  const cards = rows?.map((row) => ({
    entryId: row.entryId,
    row,
    known: knowledge.isKnown(row.entryId),
  }));
  const place: CategoryPlace = categoryPlace(mixState, of, category.id);
  const inMix = place === 'in' || place === 'last';
  const name = category.displayName;
  return {
    cards,
    inMix,
    toggleMix: () => {
      void keep('the Mix', mix.setCategory(category.id, !inMix, of)).then((done) => {
        if (done === undefined) return;
        if (!done) showToast({ message: lastCategoryHint[of] });
        else
          showToast({
            message: fill(inMix ? toasts.removed : toasts.added, { name }),
            brief: true,
          });
      });
    },
    // The Entry route of Search opens the card through `entryCard`, with the way back named.
    openEntry: (entryId) => {
      openScreen(`/search/${entryId}?back=${encodeURIComponent(name)}`);
    },
  };
}
