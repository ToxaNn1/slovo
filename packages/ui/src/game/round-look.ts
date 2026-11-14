import { createContext, useContext, type ReactNode } from 'react';

/**
 * How a Game's Round draws its question (ADR 0139): on the background with
 * no card (`gameQuestionOnGround`) and the Mascot beside it
 * (`gameRoundMascot`). The Game Round provides it for its form's parts; a
 * Quick Question, which provides none, keeps the card and no Mascot.
 */
export interface RoundLook {
  /** Whether the question stands on the background, its options at the bottom, cascading in. */
  readonly onGround: boolean;
  /** Whether the question takes the text face whatever its length, as a Definition or a sentence the board sets so. */
  readonly textFace: boolean;
  /** The Mascot beside the question; none. */
  readonly mascot: ReactNode;
}

export const RoundLookContext = createContext<RoundLook>({
  onGround: false,
  textFace: false,
  mascot: undefined,
});

export function useRoundLook(): RoundLook {
  return useContext(RoundLookContext);
}
