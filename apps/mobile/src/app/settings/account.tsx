import { Redirect, useRouter } from 'expo-router';

import { AccountScreen } from '../../account/account-screen';
import { useAccountInEffect, useAccountScreenGoogle } from '../../account/account';
import { editionStrings } from '../../edition/edition';

/** Settings › SLOVO ID. Without the Account on in effect it leads back to Settings. */
export default function SettingsAccount() {
  const router = useRouter();
  const accountOpening = useAccountInEffect();
  const google = useAccountScreenGoogle();
  if (accountOpening === undefined) return <Redirect href="/settings" />;
  return (
    <AccountScreen
      opening={accountOpening}
      google={google}
      back={{
        label: editionStrings.settings.title,
        onPress: () => {
          router.back();
        },
      }}
    />
  );
}
