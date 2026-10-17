import { useEffect, useState } from 'react';

import { useEdition } from './providers/EditionProvider';
import { SecondaryButton } from './primitives/SecondaryButton';

/** The seconds left until `at`, counted up, so the button never reads 0. */
const secondsUntil = (at: Date, now: Date) =>
  Math.max(0, Math.ceil((at.getTime() - now.getTime()) / 1000));

/**
 * «Надіслати ще раз»: until another Sign-in code may be sent it counts the
 * seconds down in their plural form and takes no press.
 */
export function ResendButton({
  resendAt,
  now,
  onPress,
  busy,
  testID,
}: {
  /** When another code may be sent, as the Account says. */
  resendAt: Date;
  /** The time it counts by, the same function from render to render, as each new one starts the count again. */
  now: () => Date;
  onPress: () => void;
  /** Whether the new code's request is on the way. */
  busy?: boolean | undefined;
  testID?: string | undefined;
}) {
  const { strings, count } = useEdition();
  const { resend, resendIn } = strings.account;
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(resendAt, now()));

  useEffect(() => {
    const tick = () => {
      const current = now();
      const left = resendAt.getTime() - current.getTime();
      setSecondsLeft(secondsUntil(resendAt, current));
      // The next tick falls where the count changes.
      if (left > 0) timer = setTimeout(tick, left % 1000 || 1000);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    tick();
    return () => {
      clearTimeout(timer);
    };
  }, [resendAt, now]);

  return (
    <SecondaryButton
      testID={testID}
      label={secondsLeft > 0 ? count(resendIn, secondsLeft) : resend}
      onPress={onPress}
      busy={busy}
      disabled={secondsLeft > 0}
    />
  );
}
