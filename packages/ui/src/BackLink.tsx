import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useEdition } from './EditionProvider';
import { minTouchTarget, space, typeSize } from './tokens';
import { useTokens } from './TokensProvider';

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
      <Text style={[styles.label, { color: colors.accent, fontFamily: fontFamilies.ui }]}>
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
