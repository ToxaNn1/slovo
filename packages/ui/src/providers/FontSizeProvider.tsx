import type { TextSize as LadderStep } from '@slovo/contracts';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

import {
  compactWidth,
  fontScaleCap,
  textSizeSteps,
  titleSize,
  wordLineHeight,
  type TypeRole,
} from '../tokens';

/** The step on the three-step text size ladder a Word text starts from (ADR 0134). */
export type TextSizeStep = LadderStep;

/** A font size and the line height that goes with it. */
export interface TextSize {
  readonly fontSize: number;
  readonly lineHeight: number;
}

/**
 * The Word card's type sizes at the user's font size. These are the design
 * sizes in points: iOS Dynamic Type multiplies the Definition and the Example
 * again when they are drawn, so the setting and the system's text size stack.
 * The Lemma, as every title that starts at 36 or more, ignores the system's
 * text size (ADR 0157).
 */
export interface WordTextSizes {
  readonly size: TextSizeStep;
  readonly lemma: TextSize;
  readonly definition: TextSize;
  readonly example: TextSize;
}

/**
 * The type sizes of a step from `textSizeSteps`, the OS text size
 * (`fontScale`) taken only up to `fontScaleCap.text`, so a very large system
 * size does not break the card frame (ADR 0134). iOS multiplies every size by
 * `fontScale` when it draws, so a capped size is given divided by the excess.
 * The Lemma takes the step alone: it is drawn without the OS text size (ADR 0157).
 */
function wordTextSizes(size: TextSizeStep, fontScale: number): WordTextSizes {
  const { lemma, definition, example } = textSizeSteps[size];
  const scale = fontScale <= 0 ? 1 : Math.min(fontScale, fontScaleCap.text) / fontScale;
  return {
    size,
    lemma: { fontSize: lemma, lineHeight: lemma * wordLineHeight.lemma },
    definition: {
      fontSize: definition * scale,
      lineHeight: definition * scale * wordLineHeight.body,
    },
    example: { fontSize: example * scale, lineHeight: example * scale * wordLineHeight.body },
  };
}

const FontSizeContext = createContext<WordTextSizes>(wordTextSizes('system', 1));

/** Gives every Word card below the type sizes of the user's text size. */
export function FontSizeProvider({ size, children }: { size: TextSizeStep; children: ReactNode }) {
  const { fontScale } = useWindowDimensions();
  const value = useMemo(() => wordTextSizes(size, fontScale), [size, fontScale]);
  return <FontSizeContext value={value}>{children}</FontSizeContext>;
}

/** The Word card's type sizes in effect: «Як у системі» outside a provider. */
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
 * one on a narrow screen. The OS text size never changes it: the Lemma is
 * drawn with `allowFontScaling` off (ADR 0157).
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

/**
 * How much the steps of `titleScale` grow or shrink here: the Lemma's size at
 * the user's in-app text size and the compact layout, over its size at M
 * (ADR 0157).
 */
export function useTitleFactor(): number {
  return useLemmaSize().fontSize / textSizeSteps.system.lemma;
}

/**
 * A card title's start size here: its role's step of `titleScale`, grown or
 * shrunk as the Lemma is (ADR 0157).
 */
export function useTitleSize(role: TypeRole): TextSize {
  const lemma = useLemmaSize();
  return useMemo(() => titleSize(role, lemma), [role, lemma]);
}
