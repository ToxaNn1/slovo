import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';

/** The share icon's size in the action row, from the design. */
const ICON_SIZE = 26;

/**
 * The share button of the action row: a box with an arrow out of it, which
 * opens the sheet with the Share Card. VoiceOver reads what a tap will do.
 */
export function ShareButton({
  onPress,
  testID = 'share-button',
}: {
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTokens();
  const { strings, voice } = useEdition();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={strings.share.button}
      {...voice}
      onPress={onPress}
      style={styles.button}
    >
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
        <Path
          d="M12 3.5v11M8 7.5l4-4 4 4M6 11v8.5h12V11"
          fill="none"
          stroke={colors.ink}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The whole 52 pt slot of the action row takes the tap.
  button: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
