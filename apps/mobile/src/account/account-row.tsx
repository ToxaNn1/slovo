import type { Account } from '@slovo/core';
import { SettingsRow } from '@slovo/ui';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useOpenScreen } from '../use-open-screen';
import { keep } from '../keep';
import { editionStrings } from '../edition/edition';
import type { Opening } from '../opening';
import { useAccountSummary } from './account';

/**
 * The «Акаунт і синхронізація» row of Settings, with «Без входу» or the
 * email, which opens the Account screen. Each time Settings opens, the Account is checked.
 */
export function AccountRow({ opening }: { opening: Opening<Account> }) {
  const openScreen = useOpenScreen();
  const { subtitle, value } = useAccountSummary(opening);
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
    <SettingsRow
      testID="settings-row-account"
      icon="hex"
      label={editionStrings.settings.rows.account}
      subtitle={subtitle}
      end={{
        kind: 'chevron',
        value,
        onPress: () => {
          openScreen('/settings/account');
        },
      }}
    />
  );
}
