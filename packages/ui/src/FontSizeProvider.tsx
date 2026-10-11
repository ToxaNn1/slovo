import type { FontSize } from '@slovo/contracts';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { fontSizeSteps } from './tokens';

/** A font size and the line height that goes with it. */
export interface TextSize {
  readonly fontSize: number;
  readonly lineHeight: number;
}

/**
 * The Word card's type sizes at the user's font size. These are the design
 * sizes in points: iOS Dynamic Type multiplies them again when the text is
 * drawn, so the setting and the system's text size stack.
 */
export interface WordTextSizes {
  readonly step: FontSize;
  readonly lemma: TextSize;
  readonly definition: TextSize;
  readonly example: TextSize;
}

// Room above the glyphs so the Stress mark over a capital or tall vowel isn't clipped.
const LEMMA_LINE_HEIGHT = 1.3;
const BODY_LINE_HEIGHT = 1.5;

/** The type sizes of a font-size step, from the one table in `fontSizeSteps`. */
export function wordTextSizes(step: FontSize): WordTextSizes {
  const { lemma, definition, example } = fontSizeSteps[step];
  return {
    step,
    lemma: { fontSize: lemma, lineHeight: lemma * LEMMA_LINE_HEIGHT },
    definition: { fontSize: definition, lineHeight: definition * BODY_LINE_HEIGHT },
    example: { fontSize: example, lineHeight: example * BODY_LINE_HEIGHT },
  };
}

const FontSizeContext = createContext<WordTextSizes>(wordTextSizes('M'));

/** Gives every Word card below the type sizes of the user's font size. */
export function FontSizeProvider({
  fontSize,
  children,
}: {
  fontSize: FontSize;
  children: ReactNode;
}) {
  const value = useMemo(() => wordTextSizes(fontSize), [fontSize]);
  return <FontSizeContext value={value}>{children}</FontSizeContext>;
}

/** The Word card's type sizes in effect: step M outside a provider. */
export function useWordTextSizes(): WordTextSizes {
  return useContext(FontSizeContext);
}
