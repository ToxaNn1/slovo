import type { Account } from '@slovo/core';
import { NavigationRow } from '@slovo/ui';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useOpenScreen } from '../use-open-screen';
import { keep } from '../keep';
import { edition } from '../edition/edition';
import type { Opening } from '../opening';
import { useAccountSummary } from './account';

/**
 * The Account row of Settings, with «Увійти» or the email, which opens the
 * Account screen. Each time Settings opens, the Account is checked.
 */
export function AccountRow({ opening }: { opening: Opening<Account> }) {
  const openScreen = useOpenScreen();
  const summary = useAccountSummary(opening);
  useFocusEffect(
    useCallback(() => {
      // The Account checks its Session with the server at most once an hour.
      void keep(
        'the Account',
        opening.opened().then((account) => account.refresh()),
      );
    }, [opening]),
  );
  return (
    <NavigationRow
      testID="settings-row-account"
      label={edition.accountName}
      value={summary}
      onPress={() => {
        openScreen('/settings/account');
      }}
    />
  );
}
