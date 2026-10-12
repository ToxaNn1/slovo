import type { UserState } from './user-state';

/** The user-state record that says the swipe hint was shown. */
const SHOWN_KEY = 'feed.swipeHintShown';

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
      return (await userState.get(SHOWN_KEY)) === undefined;
    },
    markShown() {
      return userState.write(new Map([[SHOWN_KEY, 'true']]));
    },
  };
}
