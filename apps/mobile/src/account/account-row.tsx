import { ACCOUNT_NAME } from '@slovo/contracts';
import type { Account } from '@slovo/core';
import { NavigationRow } from '@slovo/ui';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useOpenScreen } from '../entries/use-open-screen';
import { logError } from '../log';
import type { Opening } from '../opening';
import { useAccountSummary } from './account';

/**
 * The «SLOVO ID» row of Settings, with «Увійти» or the email, which opens the
 * SLOVO ID screen. Each time Settings opens, the Account is checked.
 */
export function AccountRow({ opening }: { opening: Opening<Account> }) {
  const openScreen = useOpenScreen();
  const summary = useAccountSummary(opening);
  useFocusEffect(
    useCallback(() => {
      // The Account checks its Session with the server at most once an hour.
      opening
        .opened()
        .then((account) => account.refresh())
        .catch((error: unknown) => {
          logError('Could not refresh the Account', error);
        });
    }, [opening]),
  );
  return (
    <NavigationRow
      testID="settings-row-account"
      label={ACCOUNT_NAME}
      value={summary}
      onPress={() => {
        openScreen('/settings/account');
      }}
    />
  );
}
