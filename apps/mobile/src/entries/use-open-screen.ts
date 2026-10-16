import { useRouter } from 'expo-router';

import { deviceClock } from '../device/device-clock';
import { createScreenOpener } from './open-screen';

const openScreen = createScreenOpener(deviceClock);

/**
 * Opens a screen from a tap, once however fast it is tapped. Every row, card
 * and link that pushes a screen from a tap goes through it; no screen keeps a guard of its own.
 */
export function useOpenScreen(): (href: string) => void {
  const router = useRouter();
  return (href) => {
    openScreen(router, href);
  };
}
