import { useState } from 'react';

import { useIsCurrentPage } from '../primitives/VerticalPager';

/** Self-check on one Entry card: whether its meaning is hidden, and how to reveal it. */
export interface SelfCheck {
  /** True while Self-check is on and the reader has not revealed the card yet. */
  readonly hidden: boolean;
  readonly reveal: () => void;
}

/**
 * Self-check on the Entry card of a Feed page: with `on`, the card
 * hides its meaning until the reader reveals it. The reveal lasts while the
 * card is on screen and resets once the reader turns to another page.
 */
export function useSelfCheck(on: boolean): SelfCheck {
  const current = useIsCurrentPage();
  const [revealed, setRevealed] = useState(false);
  // The card left the screen: it is hidden again when the reader comes back.
  if (revealed && !current) setRevealed(false);
  return {
    hidden: on && !revealed,
    reveal: () => {
      setRevealed(true);
    },
  };
}
