import { Redirect, useRouter } from 'expo-router';

import { AccountScreen } from '@/settings/account-screen';
import { useAccountInEffect, useAccountScreenSignIn } from '@/account/account';
import { editionStrings } from '@/edition/edition';

/** Settings › the Account. Without the Account on in effect it leads back to Settings. */
export default function SettingsAccount() {
  const router = useRouter();
  const accountOpening = useAccountInEffect();
  const signIn = useAccountScreenSignIn();
  if (accountOpening === undefined) return <Redirect href="/settings" />;
  return (
    <AccountScreen
      opening={accountOpening}
      signIn={signIn}
      back={{
        label: editionStrings.settings.title,
        onPress: () => {
          router.back();
        },
      }}
    />
  );
}
