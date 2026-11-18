import type { Random } from '../ports';

/** A cell of the grid, by its row and column from 0, from the top left corner. */
export interface PuzzlePlace {
  readonly row: number;
  readonly column: number;
}

/** A copy of the items in an order drawn from the random port: a Fisher–Yates shuffle. */
export function shuffled<T>(items: readonly T[], random: Random): T[] {
  const order = [...items];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random.next() * (i + 1));
    const a = order[i];
    const b = order[j];
    if (a === undefined || b === undefined) continue;
    order[i] = b;
    order[j] = a;
  }
  return order;
}
