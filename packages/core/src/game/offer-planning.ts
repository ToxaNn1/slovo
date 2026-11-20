import type { Schedule } from '../ports';

/** How long the Game waits before each new try of a failed planning of its offers, in milliseconds. */
const OFFER_PLANNING_RETRY_DELAYS: readonly number[] = [1_000, 2_000, 4_000];

/**
 * Makes the planning of the Game's offers in the background: the call it
 * returns plans them unless they are planned already or a planning is under
 * way. A planning that fails is tried again after each delay of
 * `OFFER_PLANNING_RETRY_DELAYS` (1, 2 and 4 s), then no more, and at once no
 * more without a schedule: the offers keep saying they are still planned
 * until the next call.
 */
export function createOfferPlanning({
  schedule,
  unplanned,
  plan,
}: {
  schedule: Schedule | undefined;
  /** Whether an offer still says it is planned. */
  unplanned: () => boolean;
  /** Plans the offers, in turn with the Game's other changes; rejects when the planning fails. */
  plan: () => Promise<void>;
}): () => void {
  /** Whether a planning of the offers is under way, or waits to try again. */
  let planning = false;

  return function planOffers(): void {
    if (planning || !unplanned()) return;
    planning = true;
    const tryPlanning = (delays: readonly number[]) => {
      plan().then(
        () => {
          planning = false;
        },
        () => {
          const [delay, ...rest] = delays;
          if (schedule === undefined || delay === undefined) {
            planning = false;
            return;
          }
          schedule(() => {
            tryPlanning(rest);
          }, delay);
        },
      );
    };
    tryPlanning(OFFER_PLANNING_RETRY_DELAYS);
  };
}
