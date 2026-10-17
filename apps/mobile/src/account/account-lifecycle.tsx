import type { Account } from '@slovo/core';
import { useEffect } from 'react';

import { useInForeground } from '../lifecycle';
import type { Opening } from '../opening';

/**
 * Checks the Account once it is open; the Account checks its Session with the
 * server at most once an hour. The app calls it at launch, in the foreground
 * and when Settings opens.
 */
export function refreshAccount(opening: Opening<Account>): void {
  opening
    .opened()
    .then((account) => account.refresh())
    .catch((error: unknown) => {
      console.error('Could not refresh the Account', error);
    });
}

/**
 * Opens the Account at launch and refreshes it each time the app is in the
 * foreground. Draws nothing.
 */
export function AccountLifecycle({ opening }: { opening: Opening<Account> }) {
  const inForeground = useInForeground();
  useEffect(() => {
    if (inForeground) refreshAccount(opening);
  }, [opening, inForeground]);
  return null;
}
