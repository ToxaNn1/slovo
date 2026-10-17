import type { Account } from '@slovo/core';
import { useEffect } from 'react';

import { useInForeground } from '../lifecycle';
import type { Opening } from '../opening';

/**
 * Opens the Account at launch and refreshes it each time the app is in the
 * foreground; the Account checks its Session with the server at most once an
 * hour. Draws nothing.
 */
export function AccountLifecycle({ opening }: { opening: Opening<Account> }) {
  const inForeground = useInForeground();
  useEffect(() => {
    if (!inForeground) return;
    opening
      .opened()
      .then((account) => account.refresh())
      .catch((error: unknown) => {
        console.error('Could not refresh the Account', error);
      });
  }, [opening, inForeground]);
  return null;
}
