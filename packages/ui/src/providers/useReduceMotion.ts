import { useContext, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { ReduceMotionSettingContext } from './ReduceMotionProvider';

/**
 * Whether the reader turned on Reduce Motion in the system settings or
 * «Менше руху» in the app, or `undefined` until the system has answered while
 * «Менше руху» is off. For an animation that starts on mount and must not
 * begin in its full form for a reader who turned it off.
 */
export function useReduceMotionKnown(): boolean | undefined {
  const setting = useContext(ReduceMotionSettingContext);
  const [reduceMotion, setReduceMotion] = useState<boolean>();
  useEffect(() => {
    // The first answer counts until the system announces a change, which is newer.
    let answered = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!answered) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      answered = true;
      setReduceMotion(enabled);
    });
    return () => {
      answered = true;
      subscription.remove();
    };
  }, []);
  return setting || reduceMotion;
}

/**
 * Whether the reader turned on Reduce Motion in the system settings or
 * «Менше руху» in the app. It follows both while the app runs; every animation has a calmer
 * variant for it (ADR 0055, `docs/design/README.md`).
 */
export function useReduceMotion(): boolean {
  return useReduceMotionKnown() === true;
}
