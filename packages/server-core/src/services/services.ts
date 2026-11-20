import type { Service } from '@slovo/contracts/admin-api';

/** Where the Services are kept: their plan, price, limits and place on the canvas. */
export interface ServiceStore {
  /** Every Service, by name. */
  list(): Promise<readonly Service[]>;
}
