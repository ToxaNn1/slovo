import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { deviceClock } from '../device/device-clock';
import { createScreenOpener } from './open-screen';

const openScreen = createScreenOpener(deviceClock);

/**
 * Opens a screen from a tap, once however fast it is tapped. Every row, card
 * and link that pushes a screen from a tap goes through it; no screen keeps a guard of its own.
 */
export function useOpenScreen(): (href: string) => void {
  const router = useRouter();
  // Kept from render to render, so a row that takes it re-renders only when its own data changes.
  return useCallback(
    (href: string) => {
      openScreen(router, href);
    },
    [router],
  );
}
