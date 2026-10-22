import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { space, typeSize } from '../tokens';
import { MixChip } from './MixChip';

/**
 * The Rarity Floor choice of the Mix screen: one chip per floor, «від 1» to
 * «від 5», the one in the Mix filled. Nothing is drawn while `shown` is false,
 * which is while the rarityFloor Feature Switch is off in effect (ADR 0040).
 */
export function RarityFloorChoice({
  shown,
  title,
  subtitle,
  options,
  floor,
  onChange,
}: {
  shown: boolean;
  title: string;
  subtitle: string;
  options: readonly { floor: number; label: string }[];
  floor: number;
  onChange: (floor: number) => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  if (!shown) return null;
  return (
    <View testID="mix-rarity" style={styles.group}>
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
            key={option.floor}
            testID={`mix-rarity-${String(option.floor)}`}
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
