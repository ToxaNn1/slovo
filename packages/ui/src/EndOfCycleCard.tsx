import { StyleSheet, Text, View } from 'react-native';

import { EmptyStateIllustration } from './DecorSlots';
import { space, typeSize } from './tokens';
import { useTokens } from './TokensProvider';

export interface EndOfCycleCardProps {
  /** Says the reader has Seen every live Entry, in the Edition's language. */
  title: string;
  /** Asks the reader to wait for new Entries and swipe on to start a new Cycle. */
  message: string;
}

/** The width of the empty-state illustration (Decor slot 4), within the design's 90–120. */
const ILLUSTRATION_WIDTH = 108;

/**
 * The end-of-Cycle card: the Edition's empty-state illustration over a
 * title and one line of muted text, centred on the Feed's background. It has
 * no surface of its own. VoiceOver reads it as one element.
 */
export function EndOfCycleCard({ title, message }: EndOfCycleCardProps) {
  const { colors, fontFamilies } = useTokens();
  return (
    <View
      testID="end-of-cycle-card"
      accessible
      accessibilityLabel={`${title}. ${message}`}
      style={styles.card}
    >
      <View style={styles.illustration}>
        <EmptyStateIllustration width={ILLUSTRATION_WIDTH} />
      </View>
      <Text style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}>
        {title}
      </Text>
      <Text style={[styles.message, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  illustration: { marginBottom: space[6] },
  title: {
    maxWidth: 300,
    fontSize: typeSize.emptyStateTitle,
    lineHeight: typeSize.emptyStateTitle * 1.2,
    fontWeight: '500',
    textAlign: 'center',
  },
  message: {
    maxWidth: 300,
    marginTop: space[4],
    fontSize: typeSize.body,
    lineHeight: typeSize.body * 1.6,
    textAlign: 'center',
  },
});
