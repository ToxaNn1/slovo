import type { EntryRowModel, EntryRows } from './entry-row';
import type { HiddenEntries } from './hidden-entries';
import { createInTurn } from './in-turn';
import type { Mix } from './mix';

/** What a hide or an unhide is for: one Entry, one Category, or Corrections as a whole. */
export type HideTarget =
  | { readonly kind: 'entry'; readonly entryId: string }
  | { readonly kind: 'category'; readonly categoryId: string }
  | { readonly kind: 'corrections' };

/** What a hide or an unhide changed: its target, and for an Entry the row whose title a toast names. */
export type HidingChange =
  | (Extract<HideTarget, { kind: 'entry' }> & { readonly row: EntryRowModel })
  | Exclude<HideTarget, { kind: 'entry' }>;

/** A hide that changed something, with the undo its toast offers. */
export interface HideResult {
  readonly changed: HidingChange;
  /** Takes the hide back: restores the Entry, or puts the Category or Corrections back in the Mix. */
  readonly undo: () => Promise<void>;
}

/** An unhide that changed something, with the undo its toast offers, if any. */
export interface UnhideResult {
  readonly changed: HidingChange;
  /**
   * Hides the Entry again at the time it was hidden before, so it returns to
   * its old place in the Hidden list. Nothing for a Category or Corrections,
   * which come back with no toast.
   */
  readonly undo: (() => Promise<void>) | undefined;
}

/** The hide action of a card and the unhide of the Hidden screen, over the Hidden Entries and the Mix. */
export interface Hiding {
  /**
   * Hides the Entry, or takes the Category or Corrections out of the Mix.
   * Nothing changes for an Entry Hidden already or one the Language Pack
   * doesn't have, a Category out of the Mix already, the last one in it or
   * one the Edition doesn't have, or Corrections out already.
   */
  hide(target: HideTarget): Promise<HideResult | undefined>;
  /**
   * Restores the Hidden Entry, or puts the Hidden Category or Corrections
   * back in the Mix. Nothing changes for an Entry that is not Hidden, a
   * Category in the Mix already or one the Edition doesn't have, or
   * Corrections in already.
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
      const { categoryId } = target;
      // `takeOut` resolves to true for a Category out already, so that is checked first.
      if (!mix.state.categoryIds.includes(categoryId)) return undefined;
      if (!(await mix.takeOut(categoryId))) return undefined;
      return { changed: { kind: 'category', categoryId }, undo: () => mix.putBack(categoryId) };
    }
    if (!mix.state.corrections) return undefined;
    await mix.setCorrections(false);
    return { changed: { kind: 'corrections' }, undo: () => mix.setCorrections(true) };
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
        undo: () => hiddenEntries.hide(entryId, hiddenAt),
      };
    }
    if (target.kind === 'category') {
      const { categoryId } = target;
      if (!mix.state.hiddenCategories.some(({ id }) => id === categoryId)) return undefined;
      await mix.putBack(categoryId);
      return { changed: { kind: 'category', categoryId }, undo: undefined };
    }
    if (mix.state.corrections) return undefined;
    await mix.setCorrections(true);
    return { changed: { kind: 'corrections' }, undo: undefined };
  }

  return {
    hide: (target) => inTurn(() => hide(target)),
    unhide: (target) => inTurn(() => unhide(target)),
  };
}
