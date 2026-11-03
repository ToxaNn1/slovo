import { createContext, useContext } from 'react';

const OnAccentContext = createContext(false);

/** Tells the parts of an Entry below it that they are drawn on the design's red ground. */
export const OnAccentProvider = OnAccentContext.Provider;

/**
 * Whether this part of an Entry is drawn on the red ground, where the accent
 * would vanish and the text takes the key ink of both Themes.
 */
export function useOnAccent(): boolean {
  return useContext(OnAccentContext);
}
