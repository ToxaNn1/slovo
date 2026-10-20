import { createContext, useContext, useState } from 'react';

import { useIsCurrentPage } from '../primitives/VerticalPager';

/** Self-check on one Entry card: whether it conceals its meaning, and how to reveal it. */
interface SelfCheck {
  /** True while Self-check applies and the reader has not revealed the card yet. */
  readonly concealed: boolean;
  readonly reveal: () => void;
}

/**
 * Self-check on an Entry card: where it applies, the card conceals its
 * meaning until the reader reveals it. The reveal lasts while the card is on
 * screen and resets once the reader turns to another page.
 */
export function useSelfCheck(applies: boolean): SelfCheck {
  const current = useIsCurrentPage();
  const [revealed, setRevealed] = useState(false);
  // The card left the screen: it is concealed again when the reader comes back.
  if (revealed && !current) setRevealed(false);
  return {
    concealed: applies && !revealed,
    reveal: () => {
      setRevealed(true);
    },
  };
}

const ConcealedContext = createContext(false);

/** Tells the action row under an Entry card whether Self-check conceals the card. */
export const ConcealedProvider = ConcealedContext.Provider;

/**
 * Whether Self-check conceals the meaning of the Entry card this is under.
 * Always false outside an Entry card.
 */
export function useConcealed(): boolean {
  return useContext(ConcealedContext);
}
