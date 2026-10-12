import { createSwipeHint } from '@slovo/core';
import { useCallback, useEffect, useState } from 'react';

import { storedUserState } from './stored-user-state';

/**
 * The Feed's swipe hint, shown on the first launch only: it is kept as shown
 * in the user state the moment it appears, and goes once the reader turns
 * the page or taps it.
 */
export function useSwipeHint(): { visible: boolean; dismiss: () => void } {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    storedUserState()
      .then(async (userState) => {
        const hint = createSwipeHint({ userState });
        if (!(await hint.isDue()) || !active) return;
        setVisible(true);
        await hint.markShown();
      })
      .catch((error: unknown) => {
        console.error('Could not read or keep the swipe hint', error);
      });
    return () => {
      active = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);
  return { visible, dismiss };
}
