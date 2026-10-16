import { StyleSheet, Text, View } from 'react-native';

import { EmptyStateIllustration } from '../decor/DecorSlots';
import { useEdition } from '../providers/EditionProvider';
import { PrimaryButton } from './PrimaryButton';
import { space, typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** The width of the empty-state illustration (Decor slot 4), within the design's 90–120. */
const ILLUSTRATION_WIDTH = 96;
/** How far the largest text sizes of iOS may scale the title. */
const TITLE_MAX_FONT_SCALE = 1.3;

/**
 * An empty list's state: the Edition's empty-state illustration (Decor slot
 * 4), a title, one line of muted text and an optional primary button.
 * VoiceOver reads the title and the text as one element.
 */
export function EmptyState({
  title,
  message,
  action,
  testID,
}: {
  title: string;
  message: string;
  /** The button under the text, such as the way back to the Feed. */
  action?: { readonly label: string; readonly onPress: () => void; readonly testID?: string };
  testID?: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <View testID={testID} style={styles.state}>
      <EmptyStateIllustration width={ILLUSTRATION_WIDTH} />
      <View accessible accessibilityLabel={`${title}. ${message}`} {...voice} style={styles.text}>
        <Text
          // A 26 pt title at the largest accessibility sizes would break a word across lines.
          maxFontSizeMultiplier={TITLE_MAX_FONT_SCALE}
          style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
        >
          {title}
        </Text>
        <Text style={[styles.message, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
          {message}
        </Text>
      </View>
      {action !== undefined && (
        <View style={styles.action}>
          <PrimaryButton testID={action.testID} label={action.label} onPress={action.onPress} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    gap: 18,
    paddingTop: 80,
    paddingHorizontal: space[8] + space[2],
    paddingBottom: space[8],
  },
  text: { alignItems: 'center', gap: 18 },
  title: {
    fontSize: 26,
    lineHeight: 26 * 1.2,
    fontWeight: '500',
    textAlign: 'center',
  },
  message: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.5, textAlign: 'center' },
  action: { marginTop: space[1] + 2 },
});
