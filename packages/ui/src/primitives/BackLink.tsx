import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { minTouchTarget, space, typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** How far the largest text sizes of iOS may scale the label. */
const LABEL_MAX_FONT_SCALE = 1.3;

/** The link at the top of a pushed screen that goes back, named for the screen it returns to. */
export function BackLink({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...voice}
      onPress={onPress}
      style={styles.link}
    >
      <Svg width={10} height={16} viewBox="0 0 10 16">
        <Path
          d="M8 1L2 8l6 7"
          fill="none"
          stroke={colors.accent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Text
        // At the largest accessibility sizes the screen's name would break across lines.
        maxFontSizeMultiplier={LABEL_MAX_FONT_SCALE}
        style={[styles.label, { color: colors.accent, fontFamily: fontFamilies.ui }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space[2],
  },
  label: { fontSize: typeSize.body + 2, fontWeight: '600' },
});
