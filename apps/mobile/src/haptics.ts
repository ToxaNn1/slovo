import type { HapticEngine } from '@slovo/core';
import * as ExpoHaptics from 'expo-haptics';

/** A haptic the device cannot play (a simulator, an old iPhone) is simply skipped. */
function skipFailure(played: Promise<void>): void {
  played.catch(() => undefined);
}

/** The device's haptic motor, over `expo-haptics`. Play through the `Haptics` of the Core only. */
export const hapticEngine: HapticEngine = {
  selection: () => {
    skipFailure(ExpoHaptics.selectionAsync());
  },
  impactLight: () => {
    skipFailure(ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light));
  },
};
