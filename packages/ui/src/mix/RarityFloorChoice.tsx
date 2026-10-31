import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { space, typeSize } from '../tokens';
import { MixChip } from './MixChip';

/**
 * The Rarity Floor choice of the Mix screen: one chip per floor, «від 1» to
 * «від 5», the one in the Mix filled. Nothing is drawn while `shown` is false,
 * which is while the rarityFloor Feature Switch is off in effect (ADR 0040).
 * The Rarity Ceiling choice, «до 1» to «до 5», and the Quick Question
 * frequency draw the same with their own `testID`.
 */
export function RarityFloorChoice<Floor extends number | string>({
  shown,
  title,
  subtitle,
  options,
  floor,
  onChange,
  testID = 'mix-rarity',
}: {
  shown: boolean;
  /** The group's test id, which each chip's id extends with its value; the Rarity Ceiling's has its own. */
  testID?: string;
  title: string;
  subtitle: string;
  options: readonly { floor: Floor; label: string }[];
  floor: Floor;
  onChange: (floor: Floor) => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  if (!shown) return null;
  return (
    <View testID={testID} style={styles.group}>
      <Text
        accessibilityRole="header"
        {...voice}
        style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.ui }]}
      >
        {title}
      </Text>
      <Text
        {...voice}
        style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {subtitle}
      </Text>
      <View style={styles.chips}>
        {options.map((option) => (
          <MixChip
            key={String(option.floor)}
            testID={`${testID}-${String(option.floor)}`}
            label={option.label}
            on={option.floor === floor}
            onPress={() => {
              onChange(option.floor);
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space[2] },
  title: { fontSize: typeSize.body, fontWeight: '600' },
  subtitle: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[1] },
});
