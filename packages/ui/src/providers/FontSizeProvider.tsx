import type { FontSize } from '@slovo/contracts';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

import { compactWidth, fontSizeSteps, wordLineHeight } from '../tokens';

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

/** The type sizes of a font-size step, from the one table in `fontSizeSteps`. */
function wordTextSizes(step: FontSize): WordTextSizes {
  const { lemma, definition, example } = fontSizeSteps[step];
  return {
    step,
    lemma: { fontSize: lemma, lineHeight: lemma * wordLineHeight.lemma },
    definition: { fontSize: definition, lineHeight: definition * wordLineHeight.body },
    example: { fontSize: example, lineHeight: example * wordLineHeight.body },
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

/** On the SE the Lemma drops from 48 to 44 at M, whatever the step. */
const COMPACT_LEMMA = 44 / 48;

/** Whether the window is narrow enough for the compact layout. */
export function useCompactLayout(): boolean {
  return useWindowDimensions().width < compactWidth;
}

/**
 * The Lemma's size at the user's font size, as the Feed and the Settings
 * preview both draw it: the table's size, or the compact layout's smaller
 * one on a narrow screen.
 */
export function useLemmaSize(): TextSize {
  const { lemma } = useWordTextSizes();
  const compact = useCompactLayout();
  return useMemo(
    () =>
      compact
        ? { fontSize: lemma.fontSize * COMPACT_LEMMA, lineHeight: lemma.lineHeight * COMPACT_LEMMA }
        : lemma,
    [lemma, compact],
  );
}
