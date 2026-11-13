import { BackLink, FeedError, space, useTokens } from '@slovo/ui';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { editionStrings } from './edition/edition';
import { ShippedMascot } from './mascot/mascot';

/**
 * The error state of a screen whose read failed: the back link to the screen
 * before, then the error with its retry, which reads again; the Mascot cringes.
 */
export function ReadFailed({
  back,
  onRetry,
  testID,
}: {
  back: { readonly testID: string; readonly label: string };
  onRetry: () => void;
  testID: string;
}) {
  const { colors } = useTokens();
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const { title, message, retry } = editionStrings.loadFailed;
  return (
    <View style={[styles.screen, { paddingTop: top, backgroundColor: colors.background }]}>
      <View style={styles.bar}>
        <BackLink
          testID={back.testID}
          label={back.label}
          onPress={() => {
            router.back();
          }}
        />
      </View>
      <FeedError
        title={title}
        message={message}
        retry={retry}
        onRetry={onRetry}
        mascot={<ShippedMascot state="cringes" />}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { paddingLeft: space[3], paddingTop: space[2] },
});
