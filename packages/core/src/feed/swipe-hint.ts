import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

const { swipeHintShown, gesturesHintShown } = userStateRecords;

/** A Feed hint that shows once on this device. */
export interface SwipeHint {
  /** Whether the hint is still to show: true until it has been shown once. */
  isDue(): Promise<boolean>;
  /** Keeps that the hint was shown, so it never shows again. */
  markShown(): Promise<void>;
}

/** The hint kept as shown in `record`. */
function hintOf(userState: UserState, record: typeof swipeHintShown): SwipeHint {
  return {
    async isDue() {
      return (await userState.read(record)) === undefined;
    },
    markShown() {
      return userState.write(record.change(true));
    },
  };
}

/** The Feed's swipe hint, which shows how to reach the next card on the first launch only. */
export function createSwipeHint({ userState }: { userState: UserState }): SwipeHint {
  return hintOf(userState, swipeHintShown);
}

/**
 * The Feed's gestures hint sheet, which shows the swipe marks and how to
 * reach the next card, once on this device, to a reader who saw the swipe
 * hint too.
 */
export function createGesturesHint({ userState }: { userState: UserState }): SwipeHint {
  return hintOf(userState, gesturesHintShown);
}
