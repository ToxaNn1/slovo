import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTokens } from '../providers/TokensProvider';
import { choiceMark } from '../tokens';

/**
 * The mark of a choice in a row: a checkbox (a rounded square) or a radio
 * (a circle). Off it is an outline; on it fills with the accent and shows a
 * tick or a dot. It only draws: the row around it is the control VoiceOver
 * reads, with its checkbox or radio role and checked state.
 */
export function ChoiceMark({
  kind,
  on,
  testID,
}: {
  kind: 'checkbox' | 'radio';
  on: boolean;
  testID?: string;
}) {
  const { colors } = useTokens();
  return (
    <View
      testID={testID}
      style={[
        styles.mark,
        kind === 'radio' ? styles.radio : styles.checkbox,
        on
          ? { backgroundColor: colors.accent, borderColor: colors.accent }
          : { borderColor: colors.muted },
      ]}
    >
      {on && kind === 'checkbox' && (
        <Svg
          testID={`${testID ?? 'choice'}-tick`}
          width={choiceMark.tick}
          height={choiceMark.tick}
          viewBox="0 0 16 16"
        >
          <Path
            d="M3 8.5l3.2 3.2L13 4.8"
            fill="none"
            stroke={colors.onAccent}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
      {on && kind === 'radio' && (
        <View
          testID={`${testID ?? 'choice'}-dot`}
          style={[styles.dot, { backgroundColor: colors.onAccent }]}
        />
      )}
    </View>
  );
}

/** The radio's dot, a third of its circle. */
const DOT = Math.round(choiceMark.size / 3);

const styles = StyleSheet.create({
  mark: {
    width: choiceMark.size,
    height: choiceMark.size,
    borderWidth: choiceMark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: { borderRadius: choiceMark.radius },
  radio: { borderRadius: choiceMark.size / 2 },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
});
