import { silentInterfaceSounds, type InterfaceSounds } from '@slovo/core';
import { createContext, useContext, type ReactNode } from 'react';

const InterfaceSoundsContext = createContext<InterfaceSounds>(silentInterfaceSounds);

/**
 * Gives every component below the app's Interface sounds, which the shell
 * builds behind the `sounds` switch and «Звуки». Without it, nothing plays.
 */
export function InterfaceSoundsProvider({
  sounds,
  children,
}: {
  sounds: InterfaceSounds;
  children: ReactNode;
}) {
  return <InterfaceSoundsContext value={sounds}>{children}</InterfaceSoundsContext>;
}

/** The Interface sounds to play. Every Interface sound of the app goes through them. */
export function useInterfaceSounds(): InterfaceSounds {
  return useContext(InterfaceSoundsContext);
}
