import { createInTurn, createSubscribers } from './in-turn';
import type { Clock } from './ports';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';

/** Where the onboarding stands. */
export interface OnboardingState {
  /** When the reader finished or skipped it; nothing while it still opens on launch. */
  readonly finishedAt: Date | undefined;
}

/**
 * The onboarding: whether the reader finished it, which is also when they
 * skipped it. It opens on launch until then, and never again after. Read from
 * the user state once, when it opens, like the Cycle, so open one per app
 * session (the Core composition does). A change is made in memory only once
 * it is written.
 */
export interface Onboarding {
  /**
   * Where the onboarding stands. Finishing never edits it: it makes a new one
   * and tells the subscribers, so it stays the same object until something
   * changes.
   */
  readonly state: OnboardingState;
  /**
   * Finishes the onboarding as of now, for the last step and for «Пропустити».
   * Finishing again keeps the first moment. Closing the app before this leaves
   * the onboarding unfinished.
   */
  finish(): Promise<void>;
  /** Calls `listener` after each change of the state. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

const { onboardingFinished } = userStateRecords;

/** Opens the onboarding over the user state, for the Core composition. */
export async function openOnboarding({
  userState,
  clock,
}: {
  userState: UserState;
  clock: Clock;
}): Promise<Onboarding> {
  const finished = await userState.read(onboardingFinished);
  let state: OnboardingState = {
    finishedAt: finished === undefined ? undefined : new Date(finished),
  };
  const subscribers = createSubscribers();
  const inTurn = createInTurn();

  return {
    get state() {
      return state;
    },
    finish: () =>
      inTurn(async () => {
        if (state.finishedAt !== undefined) return;
        const finishedAt = clock.now();
        await userState.write(onboardingFinished.change(finishedAt.toISOString()));
        state = { finishedAt };
        subscribers.tell();
      }),
    subscribe: subscribers.subscribe,
  };
}
