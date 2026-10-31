import type { Random } from './ports';

/** The items in an order drawn from the random source. */
export function shuffled<T>(items: readonly T[], random: Random): T[] {
  const order = [...items];
  for (let last = order.length - 1; last > 0; last -= 1) {
    const other = Math.floor(random.next() * (last + 1));
    [order[last], order[other]] = [order[other] as T, order[last] as T];
  }
  return order;
}
