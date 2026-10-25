import type { EntryRowModel, EntryRows } from '../entries/entry-row';
import type { HiddenEntries } from './hidden-entries';
import { createInTurn } from '../in-turn';
import { categoriesInMix, type CategoryKind, type Mix, type MixKind } from '../entries/mix';

/** What a hide or an unhide is for: one Entry, one Category, or a kind of Entry (Corrections, Idioms) as a whole. */
export type HideTarget =
  | { readonly kind: 'entry'; readonly entryId: string }
  /** A Category of the Words' list, or of the Corrections' when `of` says so (ADR 0050). */
  | { readonly kind: 'category'; readonly categoryId: string; readonly of?: CategoryKind }
  | { readonly kind: 'whole-kind'; readonly entryKind: MixKind };

/** What a hide or an unhide changed: its target, and for an Entry the row whose title a toast names. */
export type HidingChange =
  | (Extract<HideTarget, { kind: 'entry' }> & { readonly row: EntryRowModel })
  | Exclude<HideTarget, { kind: 'entry' }>;

/** A hide that changed something, with the undo its toast offers. */
export interface HideResult {
  readonly changed: HidingChange;
  /** Takes the hide back: restores the Entry, or puts the Category or the kind back in the Mix. */
  readonly undo: () => Promise<void>;
}

/** An unhide that changed something, with the undo its toast offers, if any. */
export interface UnhideResult {
  readonly changed: HidingChange;
  /**
   * When the restored Entry was hidden, for its undo in a composition opened
   * again since (ADR 0018); nothing for a Category or a kind.
   */
  readonly hiddenAt: Date | undefined;
  /**
   * Hides the Entry again at the time it was hidden before, so it returns to
   * its old place in the Hidden list. Nothing for a Category or a kind, which
   * come back with no toast.
   */
  readonly undo: (() => Promise<void>) | undefined;
}

/** The hide action of a card and the unhide of the Hidden screen, over the Hidden Entries and the Mix. */
export interface Hiding {
  /**
   * Hides the Entry, or takes the Category or the kind as a whole out of the
   * Mix. Nothing changes for an Entry Hidden already or one the Language Pack
   * doesn't have, a Category out of the Mix already, the last one in it or
   * one the Edition doesn't have, or a kind out already.
   */
  hide(target: HideTarget): Promise<HideResult | undefined>;
  /**
   * Restores the Hidden Entry, or puts the Hidden Category or the kind as a
   * whole back in the Mix. Nothing changes for an Entry that is not Hidden, a
   * Category in the Mix already or one the Edition doesn't have, or a kind in
   * already.
   */
  unhide(target: HideTarget): Promise<UnhideResult | undefined>;
}

/** The hide and the unhide, for the Core composition. */
export function createHiding({
  rows,
  hiddenEntries,
  mix,
}: {
  rows: EntryRows;
  hiddenEntries: HiddenEntries;
  mix: Mix;
}): Hiding {
  // One hide or unhide at a time, so each one checks its target after the one before it changed it.
  const inTurn = createInTurn();

  async function hide(target: HideTarget): Promise<HideResult | undefined> {
    if (target.kind === 'entry') {
      const { entryId } = target;
      if (hiddenEntries.has(entryId)) return undefined;
      const row = await rows.row(entryId);
      if (row === undefined) return undefined;
      await hiddenEntries.hide(entryId);
      return {
        changed: { kind: 'entry', entryId, row },
        undo: async () => {
          await hiddenEntries.restore(entryId);
        },
      };
    }
    if (target.kind === 'category') {
      const { categoryId, of = 'word' } = target;
      // `takeOut` resolves to true for a Category out already, so that is checked first.
      if (!categoriesInMix(mix.state, of).categoryIds.includes(categoryId)) return undefined;
      if (!(await mix.takeOut(categoryId, of))) return undefined;
      return { changed: target, undo: () => mix.putBack(categoryId, of) };
    }
    const { entryKind } = target;
    if (!mix.state.kinds[entryKind]) return undefined;
    await mix.setKind(entryKind, false);
    return { changed: target, undo: () => mix.setKind(entryKind, true) };
  }

  async function unhide(target: HideTarget): Promise<UnhideResult | undefined> {
    if (target.kind === 'entry') {
      const { entryId } = target;
      const hidden = hiddenEntries.list.find((hiddenEntry) => hiddenEntry.entryId === entryId);
      if (hidden === undefined) return undefined;
      const hiddenAt = await hiddenEntries.restore(entryId);
      // Not Hidden any more: another unhide got there first.
      if (hiddenAt === undefined) return undefined;
      return {
        changed: { kind: 'entry', entryId, row: hidden.row },
        hiddenAt,
        undo: () => hiddenEntries.hide(entryId, hiddenAt),
      };
    }
    if (target.kind === 'category') {
      const { categoryId, of = 'word' } = target;
      if (!categoriesInMix(mix.state, of).hiddenCategories.some(({ id }) => id === categoryId)) {
        return undefined;
      }
      await mix.putBack(categoryId, of);
      return { changed: target, hiddenAt: undefined, undo: undefined };
    }
    const { entryKind } = target;
    if (mix.state.kinds[entryKind]) return undefined;
    await mix.setKind(entryKind, true);
    return { changed: target, hiddenAt: undefined, undo: undefined };
  }

  return {
    hide: (target) => inTurn(() => hide(target)),
    unhide: (target) => inTurn(() => unhide(target)),
  };
}
