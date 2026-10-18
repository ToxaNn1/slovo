import { Redirect, useRouter } from 'expo-router';

import { AccountScreen } from '../../account/account-screen';
import { accountOpening } from '../../account/device-account';
import { editionStrings } from '../../edition/edition';

/** Settings › SLOVO ID. Without the Edition's Account it leads back to Settings. */
export default function SettingsAccount() {
  const router = useRouter();
  if (accountOpening === undefined) return <Redirect href="/settings" />;
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
