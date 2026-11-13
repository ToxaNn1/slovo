/** One drawn line of text, or one block that must not be cut, by its top and bottom in the content. */
export interface DrawnLine {
  readonly top: number;
  readonly bottom: number;
}

/**
 * Where content clamped to `limit` is cut so that it shows whole lines only
 * (ADR 0091): under the lowest line that ends within the limit, where no
 * other line is cut through. With no line reported it is the limit itself.
 */
export function wholeLinesCut(limit: number, lines: readonly DrawnLine[]): number {
  if (lines.length === 0) return limit;
  const cuts = lines
    .map((line) => line.bottom)
    .filter((cut) => cut <= limit && lines.every((line) => line.bottom <= cut || line.top >= cut));
  return Math.max(0, ...cuts);
}
