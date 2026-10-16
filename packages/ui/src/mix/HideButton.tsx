import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';

/** The thumb's size in the action row, from the design. */
const ICON_SIZE = 26;

/**
 * The hide button of the action row: a thumb down, which opens the hide
 * choice. VoiceOver reads what a tap will do.
 */
export function HideButton({
  onPress,
  testID = 'hide-button',
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
      accessibilityLabel={strings.hiding.button}
      {...voice}
      onPress={onPress}
      style={styles.button}
    >
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
        <Path
          d="M3.5 3.5H7v10H3.5zM7 3.5h9.4a2 2 0 0 1 2 1.6l1.3 7.1a2 2 0 0 1-2 2.3H14l.8 3.4a2.2 2.2 0 0 1-1.6 2.6l-.7.2L7 13.5"
          fill="none"
          stroke={colors.ink}
          strokeWidth={1.7}
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
