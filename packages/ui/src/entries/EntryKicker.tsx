import { Platform, StyleSheet, Text, View } from 'react-native';

import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { entryCardFrame, tightLineDrop, typeStyle, wedges } from '../tokens';

/**
 * The kicker that opens a tabbed Entry card (boards p1, XEntry2): a red wedge
 * and the label in red capitals, no fill, such as «СЛОВО ДНЯ · 7.11» or
 * «ВИПРАВЛЕННЯ». VoiceOver reads the label as written; a long label shrinks a
 * little rather than run under the corner tiles.
 */
export function EntryKicker({ label, testID }: { label: string; testID: string }) {
  const tokens = useTokens();
  const { voice } = useEdition();
  const { wedge } = entryCardFrame.kicker;
  return (
    <View testID={testID} accessible accessibilityLabel={label} {...voice} style={styles.row}>
      <Wedge
        testID={`${testID}-wedge`}
        points={wedges.wedge}
        color={tokens.colors.accent}
        width={wedge.width}
        height={wedge.height}
      />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={[
          typeStyle('cardKicker', tokens),
          styles.text,
          kickerLevel,
          { color: tokens.colors.accentText },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Moves a kicker's tight line down on iOS to where the board's CSS draws it,
 * so its capitals sit level with the middle of the corner tiles beside it.
 */
export const kickerLevel =
  Platform.OS === 'ios' ? { transform: [{ translateY: tightLineDrop('cardKicker') }] } : {};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: entryCardFrame.kicker.gap,
  },
  text: { flexShrink: 1 },
});
