import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyStateIllustration } from './DecorSlots';
import { useEdition } from './EditionProvider';
import { minTouchTarget, space, typeSize } from './tokens';
import { useTokens } from './TokensProvider';

/** The width of the empty-state illustration (Decor slot 4), within the design's 90–120. */
const ILLUSTRATION_WIDTH = 96;

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
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  return (
    <View testID={testID} style={styles.state}>
      <EmptyStateIllustration width={ILLUSTRATION_WIDTH} />
      <View accessible accessibilityLabel={`${title}. ${message}`} {...voice} style={styles.text}>
        <Text style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}>
          {title}
        </Text>
        <Text style={[styles.message, { color: colors.muted, fontFamily: fontFamilies.ui }]}>
          {message}
        </Text>
      </View>
      {action !== undefined && (
        <Pressable
          testID={action.testID}
          accessibilityRole="button"
          {...voice}
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.ink, borderRadius: radii.button, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text
            style={[styles.buttonText, { color: colors.background, fontFamily: fontFamilies.ui }]}
          >
            {action.label}
          </Text>
        </Pressable>
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
  button: {
    minHeight: 50,
    minWidth: minTouchTarget,
    marginTop: space[1] + 2,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: typeSize.body, fontWeight: '700' },
});
