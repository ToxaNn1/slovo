import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether VoiceOver or TalkBack is on, which turns the Letter Wheel's tiles
 * into buttons; off until the system answers.
 */
export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isScreenReaderEnabled().then(
      (enabled) => {
        if (active) setOn(enabled);
      },
      () => undefined,
    );
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return on;
}
