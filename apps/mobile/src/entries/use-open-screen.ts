import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { deviceClock } from '../device/device-clock';
import { createScreenOpener } from './open-screen';

const screenOpener = createScreenOpener(deviceClock);

/** The stacks call it when a transition ends, which lets the next tap open a screen. */
export const screenSettled = screenOpener.settled;

/**
 * Opens a screen from a tap, once however fast it is tapped. Every row, card
 * and link that pushes a screen from a tap goes through it; no screen keeps a guard of its own.
 */
export function useOpenScreen(): (href: string) => void {
  const router = useRouter();
  // Kept from render to render, so a row that takes it re-renders only when its own data changes.
  return useCallback(
    (href: string) => {
      screenOpener.open(router, href);
    },
    [router],
  );
}
