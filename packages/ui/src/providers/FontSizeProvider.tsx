import type { FontSize, TextSize as LadderStep } from '@slovo/contracts';
import { smallerTextSize } from '@slovo/core';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

import {
  compactWidth,
  fontScaleCap,
  fontSizeSteps,
  textSizeSteps,
  wordLineHeight,
} from '../tokens';

/**
 * The step a Word text starts from, on the scale in effect: the S…XL font
 * size while the Edition's `textSizeSteps` switch is off, the three-step
 * ladder while it is on (ADR 0134).
 */
export type TextSizeStep =
  | { readonly scale: 'fontSize'; readonly step: FontSize }
  | { readonly scale: 'ladder'; readonly step: LadderStep };

/** The S…XL step below each font size above the floor, S (ADR 0091). */
const SMALLER_FONT_SIZE: Readonly<Record<FontSize, FontSize | undefined>> = {
  S: undefined,
  M: 'S',
  L: 'M',
  XL: 'L',
};

/** The step below a size on its own scale, or nothing at the scale's floor. */
export function smallerTextSizeStep(size: TextSizeStep): TextSizeStep | undefined {
  if (size.scale === 'fontSize') {
    const step = SMALLER_FONT_SIZE[size.step];
    return step === undefined ? undefined : { scale: 'fontSize', step };
  }
  const step = smallerTextSize(size.step);
  return step === undefined ? undefined : { scale: 'ladder', step };
}

/** A name of a size, the same for the same scale and step. */
export function textSizeStepKey(size: TextSizeStep): string {
  return `${size.scale}:${size.step}`;
}

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
  readonly size: TextSizeStep;
  readonly lemma: TextSize;
  readonly definition: TextSize;
  readonly example: TextSize;
}

/**
 * The type sizes of a step: an S…XL one from `fontSizeSteps`, stacked with the
 * OS text size as before; a ladder one from `textSizeSteps`, the OS text size
 * (`fontScale`) taken only up to `fontScaleCap.text`, so a very large system
 * size does not break the card frame (ADR 0134). iOS multiplies every size by
 * `fontScale` when it draws, so a capped size is given divided by the excess.
 */
function wordTextSizes(size: TextSizeStep, fontScale: number): WordTextSizes {
  const { lemma, definition, example } =
    size.scale === 'fontSize' ? fontSizeSteps[size.step] : textSizeSteps[size.step];
  const scale =
    size.scale === 'fontSize' || fontScale <= 0
      ? 1
      : Math.min(fontScale, fontScaleCap.text) / fontScale;
  return {
    size,
    lemma: { fontSize: lemma * scale, lineHeight: lemma * scale * wordLineHeight.lemma },
    definition: {
      fontSize: definition * scale,
      lineHeight: definition * scale * wordLineHeight.body,
    },
    example: { fontSize: example * scale, lineHeight: example * scale * wordLineHeight.body },
  };
}

const FontSizeContext = createContext<WordTextSizes>(
  wordTextSizes({ scale: 'fontSize', step: 'M' }, 1),
);

/** Gives every Word card below the type sizes of the user's text size. */
export function FontSizeProvider({ size, children }: { size: TextSizeStep; children: ReactNode }) {
  const { fontScale } = useWindowDimensions();
  const value = useMemo(() => wordTextSizes(size, fontScale), [size, fontScale]);
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
