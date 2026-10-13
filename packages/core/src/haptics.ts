/** What the device can play. The shell connects it to the device's haptic motor. */
export interface HapticEngine {
  /** The light tick of a selection, such as a Feed swipe. */
  selection(): void;
  /** A light tap, such as the heart. */
  impactLight(): void;
}

/** The haptics the app plays, every one of them behind Vibration. */
export type Haptics = HapticEngine;

/**
 * The one way the app plays a haptic: it asks Vibration every time, so a
 * change in Settings applies to the very next haptic. Every haptic goes
 * through here, so Vibration off silences all of them.
 */
export function createHaptics({
  engine,
  vibration,
}: {
  engine: HapticEngine;
  /** Whether the user has Vibration on right now. */
  vibration: () => boolean;
}): Haptics {
  return {
    selection() {
      if (vibration()) engine.selection();
    },
    impactLight() {
      if (vibration()) engine.impactLight();
    },
  };
}
