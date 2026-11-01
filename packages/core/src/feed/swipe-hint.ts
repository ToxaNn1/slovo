import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

const { swipeHintShown } = userStateRecords;

/**
 * The Feed's swipe hint, which shows how to reach the next card on the first
 * launch only.
 */
export interface SwipeHint {
  /** Whether the hint is still to show: true until it has been shown once. */
  isDue(): Promise<boolean>;
  /** Keeps that the hint was shown, so it never shows again. */
  markShown(): Promise<void>;
}

export function createSwipeHint({ userState }: { userState: UserState }): SwipeHint {
  return {
    async isDue() {
      return (await userState.read(swipeHintShown)) === undefined;
    },
    markShown() {
      return userState.write(swipeHintShown.change(true));
    },
  };
}
