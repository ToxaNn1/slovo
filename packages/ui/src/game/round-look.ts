import { createContext, useContext, type ReactNode } from 'react';

/**
 * How a Game's Round draws its question: on the background with
 * no card and the Mascot beside it
 * (`gameRoundMascot`), and its options in the board's look. The Game Round provides it for its form's parts; a
 * Quick Question, which provides none, keeps the card, the keyed options
 * and no Mascot.
 */
/** Which face a question on the ground takes; see `RoundLook.questionFace`. */
export type QuestionFace = 'byLength' | 'text' | 'display';

export interface RoundLook {
  /** Whether the question stands on the background, its options at the bottom, cascading in: always in a Game's Round, never in a Quick Question. */
  readonly onGround: boolean;
  /** Whether the options take the board's look: none keyed, a short one large, the right one stamped ✓ and the wrong text crossed out; always in a Game's Round, never in a Quick Question. */
  readonly optionStamp: boolean;
  /**
   * The face of the question on the ground: the large display face up to 40
   * characters and the text face past that (`byLength`), the text face
   * whatever its length, as a Definition or a sentence the board sets so
   * (`text`), or the large display face whatever its length, sized down for
   * a long one, as the Definition of «Анаграми» (`display`).
   */
  readonly questionFace: QuestionFace;
  /**
   * Whether the question stands under its label as an ink heading of its own
   * on the ground (board 06 «Наголос», g3, g4), such as «Де наголос?», in
   * place of the red label, showing only what the board shows under it.
   */
  readonly inkHeaded: boolean;
  /** The Mascot beside the question; none. */
  readonly mascot: ReactNode;
  /** The Game Mode and the Round over the question on the ground, «Наголос · 1/10»; none in a Quick Question. */
  readonly kicker: string | undefined;
}

export const RoundLookContext = createContext<RoundLook>({
  onGround: false,
  optionStamp: false,
  questionFace: 'byLength',
  inkHeaded: false,
  mascot: undefined,
  kicker: undefined,
});

export function useRoundLook(): RoundLook {
  return useContext(RoundLookContext);
}
