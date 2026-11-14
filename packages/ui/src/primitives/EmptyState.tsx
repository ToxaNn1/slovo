import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { Button } from './Button';
import { emptyState, fontScaleCap, space, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/**
 * An empty list's state (board 09): the Mascot on top when the app shows it,
 * a title, a muted text and an optional primary
 * button, centred in the room its list gives it. VoiceOver reads the title and
 * the text as one element.
 */
export function EmptyState({
  title,
  message,
  action,
  mascot,
  testID,
}: {
  title: string;
  message: string;
  /** The button under the text, such as the way back to the Feed. */
  action?: { readonly label: string; readonly onPress: () => void; readonly testID?: string };
  /** The Mascot at the width the state gives it (board 09: 140), drawn on top, if the app shows it. */
  mascot?: (width: number) => ReactNode;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <View testID={testID} style={styles.state}>
      {mascot?.(emptyState.mascotWidth)}
      <View accessible accessibilityLabel={`${title}. ${message}`} {...voice} style={styles.text}>
        <Text
          // A 22 pt title at the largest accessibility sizes would break a word across lines.
          maxFontSizeMultiplier={fontScaleCap.number}
          style={[typeStyle('emptyTitle', tokens), styles.centered, { color: colors.ink }]}
        >
          {title}
        </Text>
        <Text style={[typeStyle('emptyText', tokens), styles.centered, { color: colors.muted }]}>
          {message}
        </Text>
      </View>
      {action !== undefined && (
        <View style={styles.action}>
          <Button testID={action.testID} label={action.label} onPress={action.onPress} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // A list that gives it the room (`flexGrow: 1`) centres it; any other keeps it near the top.
  state: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: emptyState.gap,
    paddingTop: emptyState.paddingTop,
    paddingHorizontal: space[8],
    paddingBottom: emptyState.paddingBottom,
  },
  text: { alignItems: 'center', gap: emptyState.gap },
  centered: { textAlign: 'center' },
  action: { marginTop: space[1] + 2 },
});
