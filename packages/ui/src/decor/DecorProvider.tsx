import { coreDecor, type Decor } from '@slovo/core';
import { createContext, useContext, type ReactNode } from 'react';

const DecorContext = createContext<Decor>(coreDecor);

/** Gives everything below the Edition's Decor: the Mascot, its accessory and the Categories. */
export function DecorProvider({ decor, children }: { decor: Decor; children: ReactNode }) {
  return <DecorContext value={decor}>{children}</DecorContext>;
}

/** The Decor in effect; the Core's neutral Decor outside a provider. */
export function useDecor(): Decor {
  return useContext(DecorContext);
}
