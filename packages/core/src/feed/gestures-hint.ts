import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

const { gesturesHintShown } = userStateRecords;

/** A Feed hint that shows once on this device. */
export interface GesturesHint {
  /** Whether the hint is still to show: true until it has been shown once. */
  isDue(): Promise<boolean>;
  /** Keeps that the hint was shown, so it never shows again. */
  markShown(): Promise<void>;
}

/**
 * The Feed's gestures hint sheet, «ГОРТАЙ ПАЛЬЦЕМ», which shows the swipe
 * marks and how to reach the next card, once on this device, to every reader,
 * also one who saw the retired swipe hint.
 */
export function createGesturesHint({ userState }: { userState: UserState }): GesturesHint {
  return {
    async isDue() {
      return (await userState.read(gesturesHintShown)) === undefined;
    },
    markShown() {
      return userState.write(gesturesHintShown.change(true));
    },
  };
}
