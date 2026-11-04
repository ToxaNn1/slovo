import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { space, typeStyle } from '../tokens';
import { Chip } from '../primitives/Chip';

/**
 * One choice of the Mix screen drawn as chips under its title and subtitle,
 * the chosen one filled: the Quick Question frequency. Each chip's test id
 * extends the group's `testID` with its value.
 */
export function ChipChoice<Value extends number | string>({
  testID,
  title,
  subtitle,
  options,
  value,
  onChange,
}: {
  testID: string;
  title: string;
  subtitle: string;
  options: readonly { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <View testID={testID} style={styles.group}>
      <Text
        accessibilityRole="header"
        {...voice}
        style={[typeStyle('rowLabel', tokens), { color: colors.ink }]}
      >
        {title}
      </Text>
      <Text {...voice} style={[typeStyle('sub', tokens), { color: colors.muted }]}>
        {subtitle}
      </Text>
      <View style={styles.chips}>
        {options.map((option) => (
          <Chip
            key={String(option.value)}
            testID={`${testID}-${String(option.value)}`}
            label={option.label}
            on={option.value === value}
            onPress={() => {
              onChange(option.value);
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[1] },
});
