import { Redirect, useRouter } from 'expo-router';

import { AccountScreen } from '../../account/account-screen';
import { accountOpening } from '../../account/device-account';
import { editionStrings } from '../../edition/edition';
import { useEditionInEffect } from '../../edition/remote-switches';

/** Settings › SLOVO ID. Without the Account on in effect it leads back to Settings. */
export default function SettingsAccount() {
  const router = useRouter();
  const withAccount = useEditionInEffect().isFeatureEnabled('account');
  if (!withAccount || accountOpening === undefined) return <Redirect href="/settings" />;
  return (
    <AccountScreen
      opening={accountOpening}
      back={{
        label: editionStrings.settings.title,
        onPress: () => {
          router.back();
        },
      }}
    />
  );
}
