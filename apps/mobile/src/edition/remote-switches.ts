import type { Edition } from '@slovo/core';

import { useOpened, useSubscribed } from '../opening';
import { useShell } from '../shell-value';

/**
 * The Edition as the app runs it, each Feature Switch at its effective value,
 * for a screen drawn under the gate of the Language Pack, which opens after
 * the remote switches. The screen draws again when an effective value changes.
 */
export function useEditionInEffect(): Edition {
  return useSubscribed(useOpened(useShell().remoteSwitches), ({ edition }) => edition);
}
