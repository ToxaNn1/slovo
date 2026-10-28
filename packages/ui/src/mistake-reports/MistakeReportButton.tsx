import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';

/** The flag's size in the action row, the size of the other icons. */
const ICON_SIZE = 26;

/**
 * The «Повідомити про помилку» button of the action row: a flag, which opens
 * the sheet of a Mistake Report. VoiceOver reads what a tap will do.
 */
export function MistakeReportButton({
  onPress,
  testID = 'mistake-report-button',
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
      accessibilityLabel={strings.mistakeReport.action}
      {...voice}
      onPress={onPress}
      style={styles.button}
    >
      <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24">
        <Path
          d="M5.5 20.5v-16M5.5 4.5h11.5l-2.5 4.5 2.5 4.5H5.5"
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
