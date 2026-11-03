import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { space, streakPill, typeStyle } from '../tokens';

/** How far the largest text sizes of iOS may scale the number, so it stays inside the 32 pt pill. */
const NUMBER_MAX_FONT_SCALE = 1.3;

/**
 * The XP earned in all on an ink pill beside the Games screen's title, from
 * the design, such as «45 XP»; VoiceOver reads its own label, such as
 * «Усього XP: 45». It takes no tap.
 */
export function XpPill({ text, label, testID }: { text: string; label: string; testID?: string }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      {...voice}
      style={[styles.pill, { backgroundColor: colors.ink }]}
    >
      <Text
        maxFontSizeMultiplier={NUMBER_MAX_FONT_SCALE}
        style={[typeStyle('xpPill', tokens), { color: colors.background }]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: streakPill.height,
    borderRadius: streakPill.radius,
    paddingHorizontal: space[3],
    justifyContent: 'center',
  },
});
