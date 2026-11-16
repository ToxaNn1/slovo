import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { space, tornThread, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { Button } from '../primitives/Button';

/**
 * The local error state (board XSettings m7), such as when the Language Pack
 * can't be opened: its art when the app gives one, such as the torn thread,
 * a title, what went wrong and a compact button at the middle that tries
 * again. Nothing here speaks of the network: the Feed never needs it.
 */
export function FeedError({
  title,
  message,
  retry,
  onRetry,
  art,
  testID = 'feed-error',
}: {
  title: string;
  message: string;
  /** The label of the button that tries again. */
  retry: string;
  onRetry: () => void;
  /** The art drawn over the title, such as `TornThread`, if the app shows one. */
  art?: ReactNode;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <View testID={testID} style={styles.error}>
      {art}
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={`${title}. ${message}`}
        {...voice}
      >
        <Text style={[typeStyle('errorTitle', tokens), styles.center, { color: colors.ink }]}>
          {title}
        </Text>
        <Text
          style={[typeStyle('errorText', tokens), styles.errorMessage, { color: colors.muted }]}
        >
          {message}
        </Text>
      </View>
      <View style={styles.button}>
        <Button variant="inverse" label={retry} onPress={onRetry} testID={`${testID}-retry`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  error: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tornThread.gap,
    paddingHorizontal: space[8],
  },
  center: { textAlign: 'center' },
  errorMessage: { marginTop: tornThread.gap, textAlign: 'center' },
  button: { marginTop: tornThread.buttonGap },
});
