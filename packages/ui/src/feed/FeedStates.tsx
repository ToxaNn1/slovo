import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { space, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { WedgeLoader } from '../primitives/WedgeLoader';

/**
 * The Feed's loading state while the Language Pack opens: the design's red
 * wedges and a line of text under them, under the Mascot waiting when the app
 * shows it. With Reduce Motion the wedges stand still. VoiceOver reads it as
 * one element.
 */
export function FeedLoading({
  text,
  accessibilityLabel,
  mascot,
}: {
  text: string;
  accessibilityLabel: string;
  /** The Mascot waiting, over the wedges, if the app shows it. */
  mascot?: ReactNode;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();

  return (
    <View
      testID="feed-loading"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
      {...voice}
      style={styles.loading}
    >
      {mascot !== undefined && <View style={styles.mascot}>{mascot}</View>}
      <WedgeLoader testID="feed-loading-wedges" />
      <Text
        {...voice}
        style={[typeStyle('sub', tokens), styles.loadingText, { color: colors.muted }]}
      >
        {text}
      </Text>
    </View>
  );
}

/**
 * The Feed's local error state, when the Language Pack can't be opened: the
 * Mascot when the app shows it, a title, what went wrong and a button that
 * tries again. Nothing here speaks
 * of the network: the Feed never needs it.
 */
export function FeedError({
  title,
  message,
  retry,
  onRetry,
  mascot,
  testID = 'feed-error',
}: {
  title: string;
  message: string;
  /** The label of the button that tries again. */
  retry: string;
  onRetry: () => void;
  /** The Mascot drawn over the title, if the app shows it. */
  mascot?: ReactNode;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors, radii } = tokens;
  const { voice } = useEdition();
  return (
    <View testID={testID} style={styles.error}>
      {mascot !== undefined && <View style={styles.illustration}>{mascot}</View>}
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
      <Pressable
        testID={`${testID}-retry`}
        accessibilityRole="button"
        {...voice}
        onPress={onRetry}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: colors.ink, borderRadius: radii.button, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[typeStyle('buttonLabel', tokens), { color: colors.background }]}>
          {retry}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', gap: space[6] + space[1] },
  mascot: { alignItems: 'center' },
  loadingText: { textAlign: 'center' },
  error: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[8] + space[2],
  },
  illustration: { marginBottom: space[6] },
  center: { textAlign: 'center' },
  errorMessage: { marginTop: space[3], textAlign: 'center' },
  button: {
    alignSelf: 'stretch',
    minHeight: 54,
    marginTop: space[8],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
