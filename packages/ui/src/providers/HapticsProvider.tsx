import type { Haptics } from '@slovo/core';
import { createContext, useContext, type ReactNode } from 'react';

const HapticsContext = createContext<Haptics | undefined>(undefined);

/**
 * Gives every component below the app's haptics: the one helper that respects
 * Vibration, which the shell builds over the device's haptic motor.
 */
export function HapticsProvider({ haptics, children }: { haptics: Haptics; children: ReactNode }) {
  return <HapticsContext value={haptics}>{children}</HapticsContext>;
}

/** The haptics to play. Every haptic of the app goes through them. */
export function useHaptics(): Haptics {
  const haptics = useContext(HapticsContext);
  if (haptics === undefined) throw new Error('useHaptics needs a HapticsProvider above it');
  return haptics;
}
