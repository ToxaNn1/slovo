import { createSwipeHint, type SwipeHint } from '@slovo/core';
import { useCallback, useEffect, useState } from 'react';

import { logError } from '../diagnostics/log';
import { useShell } from '../shell-value';

/**
 * The Feed's swipe hint, shown on the first launch only. It is due until it
 * has been shown once, and it counts as shown only when `SwipeHint` is
 * drawn (`markShown`), so a launch that ends in loading, an error or an empty
 * Feed leaves it for the next one. It goes once the reader turns the page
 * or taps it.
 */
export function useSwipeHint(): { visible: boolean; markShown: () => void; dismiss: () => void } {
  /** The hint, once it is known to be due. */
  const [due, setDue] = useState<SwipeHint>();
  const [dismissed, setDismissed] = useState(false);
  const { userState } = useShell();

  useEffect(() => {
    let active = true;
    userState
      .opened()
      .then(async (userState) => {
        const hint = createSwipeHint({ userState });
        if ((await hint.isDue()) && active) setDue(hint);
      })
      .catch((error: unknown) => {
        logError('Could not read the swipe hint', error);
      });
    return () => {
      active = false;
    };
  }, [userState]);

  const markShown = useCallback(() => {
    due?.markShown().catch((error: unknown) => {
      logError('Could not keep the swipe hint', error);
    });
  }, [due]);
  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);
  return { visible: due !== undefined && !dismissed, markShown, dismiss };
}
