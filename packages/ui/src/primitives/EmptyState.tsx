import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { Button } from './Button';
import { blockGap, emptyStatePaddingTop, space, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** How far the largest text sizes of iOS may scale the title. */
const TITLE_MAX_FONT_SCALE = 1.3;

/**
 * An empty list's state: the Mascot on top when the app shows it, a title,
 * one line of muted text and an optional primary button.
 * VoiceOver reads the title and the text as one element.
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
  /** The Mascot in its empty state, drawn on top, if the app shows it. */
  mascot?: ReactNode;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <View testID={testID} style={styles.state}>
      {mascot}
      <View accessible accessibilityLabel={`${title}. ${message}`} {...voice} style={styles.text}>
        <Text
          // A 22 pt title at the largest accessibility sizes would break a word across lines.
          maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
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
  state: {
    alignItems: 'center',
    gap: blockGap,
    paddingTop: emptyStatePaddingTop,
    paddingHorizontal: space[8] + space[2],
    paddingBottom: space[8],
  },
  text: { alignItems: 'center', gap: blockGap },
  centered: { textAlign: 'center' },
  action: { marginTop: space[1] + 2 },
});
