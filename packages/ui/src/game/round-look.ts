import { createContext, useContext, type ReactNode } from 'react';

/**
 * How a Game's Round draws its question (ADR 0139): on the background with
 * no card (`gameQuestionOnGround`) and the Mascot beside it
 * (`gameRoundMascot`). The Game Round provides it for its form's parts; a
 * Quick Question, which provides none, keeps the card and no Mascot.
 */
/** Which face a question on the ground takes; see `RoundLook.questionFace`. */
export type QuestionFace = 'byLength' | 'text' | 'display';

export interface RoundLook {
  /** Whether the question stands on the background, its options at the bottom, cascading in. */
  readonly onGround: boolean;
  /**
   * The face of the question on the ground: the large display face up to 40
   * characters and the text face past that (`byLength`), the text face
   * whatever its length, as a Definition or a sentence the board sets so
   * (`text`), or the large display face whatever its length, sized down for
   * a long one, as the Definition of «Анаграми» (`display`).
   */
  readonly questionFace: QuestionFace;
  /** The Mascot beside the question; none. */
  readonly mascot: ReactNode;
}

export const RoundLookContext = createContext<RoundLook>({
  onGround: false,
  questionFace: 'byLength',
  mascot: undefined,
});

export function useRoundLook(): RoundLook {
  return useContext(RoundLookContext);
}
