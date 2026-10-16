import type { History, HistoryEntry } from '@slovo/core';
import { useEdition } from '@slovo/ui';
import { useIsFocused } from 'expo-router';
import { useMemo } from 'react';

import { useComposed, useModule } from '../composition';
import { deviceClock } from '../device/device-clock';
import { editionStrings } from '../edition/edition';
import { historyText } from './history-text';

const noHistory: readonly HistoryEntry[] = [];

/** History of the session's Core composition, once it is open. */
function useHistory(): History | undefined {
  return useModule((composition) => composition.history);
}

/** The Entries in History, newest first, kept up to date; none until History opens. */
export function useHistoryList(): readonly HistoryEntry[] {
  return useComposed(
    (composition) => composition.history,
    (history) => history.list,
    noHistory,
  );
}

/**
 * Clears History. A change that could not be kept is logged and leaves History
 * as it was.
 */
export function useClearHistory(): () => void {
  const history = useHistory();
  return () => {
    history?.clear().catch((error: unknown) => {
      console.error('Could not clear History', error);
    });
  };
}

/**
 * The words of History on the device's clock. A relative time reads the clock
 * as it renders, so a screen that comes back into focus renders again and the
 * times it shows are no older than that.
 */
export function useHistoryText() {
  const { count } = useEdition();
  // Re-renders the screen when it gains or loses focus, so «щойно» does not go stale.
  useIsFocused();
  return useMemo(
    () => historyText({ strings: editionStrings.history, count, clock: deviceClock }),
    [count],
  );
}
