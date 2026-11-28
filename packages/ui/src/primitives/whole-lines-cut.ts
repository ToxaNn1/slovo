/**
 * One drawn line of text, by its top and bottom in the content and where its text ends on the
 * right (`end`), or one block that must not be cut, by its top and bottom.
 */
export type DrawnLine =
  | { readonly kind: 'text'; readonly top: number; readonly bottom: number; readonly end: number }
  | { readonly kind: 'block'; readonly top: number; readonly bottom: number };

/**
 * Where content clamped to `limit` is cut so that it shows whole lines only:
 * under the lowest line that ends within the limit, where no
 * other line is cut through. With no line reported it is the limit itself.
 */
export function wholeLinesCut(limit: number, lines: readonly DrawnLine[]): number {
  if (lines.length === 0) return limit;
  const cuts = lines
    .map((line) => line.bottom)
    .filter((cut) => cut <= limit && lines.every((line) => line.bottom <= cut || line.top >= cut));
  return Math.max(0, ...cuts);
}

/**
 * The last line clamped content shows when cut at `cut`, from its top to
 * `cut`: the tallest of the lines that end there, or none when no line does.
 */
export function lastLineShown(cut: number, lines: readonly DrawnLine[]): DrawnLine | undefined {
  return lines
    .filter((line) => line.bottom === cut)
    .reduce<DrawnLine | undefined>(
      (tallest, line) => (tallest === undefined || line.top < tallest.top ? line : tallest),
      undefined,
    );
}
