import { createGesturesHint, type GesturesHint } from '@slovo/core';
import { useCallback, useEffect, useState } from 'react';

import { logError } from '../diagnostics/log';
import { useShell } from '../shell-value';

/**
 * The Feed's gestures hint sheet, «ГОРТАЙТЕ ПАЛЬЦЕМ», shown once on this
 * device while the side swipes mark an Entry (`on`, `Shown.swipeMarks`). It is
 * due until it has been shown once, and it counts as shown only when
 * `GesturesHintSheet` is drawn (`markShown`), so a launch that ends in
 * loading, an error or an empty Feed leaves it for the next one. It goes once
 * the reader taps «ЗРОЗУМІЛО» (`dismiss`).
 */
export function useGesturesHint(on: boolean): {
  visible: boolean;
  markShown: () => void;
  dismiss: () => void;
} {
  /** The hint, once it is known to be due. */
  const [due, setDue] = useState<GesturesHint>();
  const [dismissed, setDismissed] = useState(false);
  const { userState } = useShell();

  useEffect(() => {
    if (!on) return;
    let active = true;
    userState
      .opened()
      .then(async (userState) => {
        const hint = createGesturesHint({ userState });
        if ((await hint.isDue()) && active) setDue(hint);
      })
      .catch((error: unknown) => {
        logError('Could not read the gestures hint', error);
      });
    return () => {
      active = false;
    };
  }, [on, userState]);

  const markShown = useCallback(() => {
    due?.markShown().catch((error: unknown) => {
      logError('Could not keep the gestures hint', error);
    });
  }, [due]);
  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);
  return { visible: on && due !== undefined && !dismissed, markShown, dismiss };
}
