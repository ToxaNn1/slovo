import type { TextSize } from '@slovo/contracts';

/**
 * The text sizes as one ordered ladder, the smallest first (ADR 0134). A
 * setting value names the step a text starts from; «Як у системі» follows the
 * OS text size within a cap, and «Більший» and «Найбільший» sit above it.
 */
export const TEXT_SIZE_LADDER = [
  'system',
  'larger',
  'largest',
] as const satisfies readonly TextSize[];

/** The ladder's lowest step: a text too tall here is clamped, never drawn smaller. */
export const TEXT_SIZE_FLOOR = TEXT_SIZE_LADDER[0];

/** The step under a text size on the ladder, or nothing at the floor. */
export function smallerTextSize(size: TextSize): TextSize | undefined {
  return TEXT_SIZE_LADDER[TEXT_SIZE_LADDER.indexOf(size) - 1];
}
