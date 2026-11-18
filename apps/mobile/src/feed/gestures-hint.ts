import { createGesturesHint, type GesturesHint } from '@slovo/core';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { logError } from '../diagnostics/log';
import { keep } from '../keep';
import { useShell } from '../shell-value';

/**
 * How many times «Показати підказку жестів» was tapped this run: the Feed tab
 * stays mounted, so it reads the hint afresh on each tap.
 */
let shownAgain = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * «Показати підказку жестів» in Settings: forgets that the hint was shown and
 * has the Feed show it once more (owner 16.11).
 */
export function useShowGesturesHintAgain(): () => Promise<void> {
  const { userState } = useShell();
  return useCallback(async () => {
    await createGesturesHint({ userState: await userState.opened() }).showAgain();
    shownAgain += 1;
    for (const listener of listeners) listener();
  }, [userState]);
}

/**
 * The Feed's gestures hint sheet, «ГОРТАЙ ПАЛЬЦЕМ», shown once on this
 * device while the side swipes mark an Entry (`on`, the Knowledge switch in effect). It is
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
  /** The count of «Показати підказку жестів» at which the reader dismissed the hint. */
  const [dismissedAt, setDismissedAt] = useState<number>();
  const { userState } = useShell();
  const again = useSyncExternalStore(subscribe, () => shownAgain);

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
  }, [on, userState, again]);

  const markShown = useCallback(() => {
    if (due !== undefined) void keep('the gestures hint', due.markShown());
  }, [due]);
  const dismiss = useCallback(() => {
    setDismissedAt(again);
  }, [again]);
  return { visible: on && due !== undefined && dismissedAt !== again, markShown, dismiss };
}
