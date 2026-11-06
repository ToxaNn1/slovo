import type { Composition } from '@slovo/core';
import { useCallback } from 'react';

import { keep } from './keep';
import { useShell } from './shell-value';

/** An undo a toast offers, as the Core gives it: run in the composition it is handed. */
export type Undo = (open: Composition) => Promise<void>;

/**
 * The one way an undo toast takes a change back: on the tap it opens the
 * composition open now, which a reopen in the toast's seconds may have
 * replaced since the change (ADR 0018), and runs the undo in it, through
 * `keep`.
 */
export function useUndo(): (subject: string, undo: Undo) => void {
  const compositionOpening = useShell().composition;
  return useCallback(
    (subject, undo) => {
      void keep(subject, compositionOpening.opened().then(undo));
    },
    [compositionOpening],
  );
}
