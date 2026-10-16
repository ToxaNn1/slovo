import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';

/** The bookmark's size in the action row, from the design. */
const ICON_SIZE = 26;

/**
 * The Collections button of the action row: a bookmark with a plus, which
 * opens the «До колекції» sheet. VoiceOver reads what a tap will do.
 */
export function CollectionButton({
  onPress,
  testID = 'collection-button',
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
      accessibilityLabel={strings.collections.button}
      {...voice}
      onPress={onPress}
      style={styles.button}
    >
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
        <Path
          d="M6.5 3.5h11v17l-5.5-4-5.5 4z"
          fill="none"
          stroke={colors.ink}
          strokeWidth={1.7}
          strokeLinejoin="round"
        />
        <Path
          d="M12 7v5M9.5 9.5h5"
          fill="none"
          stroke={colors.ink}
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The whole 52 pt slot of the action row takes the tap.
  button: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
});
