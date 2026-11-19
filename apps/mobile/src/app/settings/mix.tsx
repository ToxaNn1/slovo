import { useRouter } from 'expo-router';

import { editionStrings } from '@/edition/edition';
import { MyMixScreen } from '@/mix/my-mix-screen';

/** Settings › Мій Мікс: the screen of the tab «Мікс», with the way back to Settings. */
export default function MixScreen() {
  const router = useRouter();
  return (
    <MyMixScreen
      back={{
        label: editionStrings.settings.title,
        onPress: () => {
          router.back();
        },
      }}
    />
  );
}
