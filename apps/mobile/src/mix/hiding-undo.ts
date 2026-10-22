import type { Composition, HidingChange } from '@slovo/core';

/*
 * The undos of the hide and restore toasts, made in the composition open when
 * the reader taps «Скасувати»: a reopen in the toast's seconds replaces the
 * composition that hid or restored, and closes it (ADR 0018).
 */

/** Takes a hide back: restores the Entry, or puts the Category or Corrections back in the Mix. */
export async function undoHide(
  composition: Pick<Composition, 'unhide'>,
  changed: HidingChange,
): Promise<void> {
  await composition.unhide(changed);
}

/** Hides a restored Entry again at `hiddenAt`, so it returns to its old place in the Hidden list. */
export function undoRestore(
  composition: Pick<Composition, 'hiddenEntries'>,
  entryId: string,
  hiddenAt: Date,
): Promise<void> {
  return composition.hiddenEntries.hide(entryId, hiddenAt);
}
