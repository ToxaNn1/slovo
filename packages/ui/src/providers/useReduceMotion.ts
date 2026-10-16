import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the reader turned on Reduce Motion in the system settings, or
 * `undefined` until the system has answered. For an animation that starts on
 * mount and must not begin in its full form for a reader who turned it off.
 */
export function useReduceMotionKnown(): boolean | undefined {
  const [reduceMotion, setReduceMotion] = useState<boolean>();
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduceMotion;
}

/**
 * Whether the reader turned on Reduce Motion in the system settings. It
 * follows the setting while the app runs; every animation has a calmer
 * variant for it (`docs/design/design-system.md`, "Motion, sound and haptics").
 */
export function useReduceMotion(): boolean {
  return useReduceMotionKnown() === true;
}
