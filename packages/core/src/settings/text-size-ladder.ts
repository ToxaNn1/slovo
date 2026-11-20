import type { TextSize } from '@slovo/contracts';

/**
 * The text sizes as one ordered ladder, the smallest first. A
 * setting value names the step a text starts from; «Як у системі» follows the
 * OS text size within a cap, and «Більший» and «Найбільший» sit above it.
 */
export const TEXT_SIZE_LADDER = [
  'system',
  'larger',
  'largest',
] as const satisfies readonly TextSize[];

/**
 * The step under a text size on the ladder, or nothing at the floor, its
 * lowest step: a text too tall there is clamped, never drawn smaller.
 */
export function smallerTextSize(size: TextSize): TextSize | undefined {
  return TEXT_SIZE_LADDER[TEXT_SIZE_LADDER.indexOf(size) - 1];
}
