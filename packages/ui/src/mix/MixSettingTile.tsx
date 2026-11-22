import { StyleSheet, Text, View } from 'react-native';

import { PressedTile } from '../primitives/PressedTile';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { mixScreenDrawing, typeStyle } from '../tokens';

const { tile, bar } = mixScreenDrawing;

/** One small bar of a setting tile: its height and whether it is lit, red or ink. */
export interface MixSettingBar {
  readonly height: number;
  readonly lit: 'accent' | 'ink' | false;
}

/**
 * A setting tile of «Мої Теми» (board XMix, variant E): its name, a row of
 * slanted bars that draws the setting, and its value, big. A tap opens the
 * setting's sheet; VoiceOver reads «name, value», or the tile's own label
 * where the value written short reads badly aloud («3/4»).
 */
export function MixSettingTile({
  label,
  value,
  accessibilityLabel = `${label}, ${value}`,
  bars,
  onPress,
  testID,
}: {
  label: string;
  value: string;
  accessibilityLabel?: string | undefined;
  bars: readonly MixSettingBar[];
  onPress: () => void;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <PressedTile
      testID={testID}
      tone="tile"
      radius={tile.radius}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      faceStyle={styles.face}
    >
      <Text {...voice} style={[typeStyle('mixSettingLabel', tokens), { color: colors.ink }]}>
        {label}
      </Text>
      <View style={styles.bars}>
        {bars.map(({ height, lit }, at) => (
          <View
            key={at}
            style={[
              styles.bar,
              {
                height,
                backgroundColor:
                  lit === 'accent' ? colors.accent : lit === 'ink' ? colors.ink : colors.silhouette,
              },
            ]}
          />
        ))}
      </View>
      <Text
        {...voice}
        testID={`${testID}-value`}
        numberOfLines={1}
        style={[typeStyle('mixSettingValue', tokens), { color: colors.ink }]}
      >
        {value}
      </Text>
    </PressedTile>
  );
}

const styles = StyleSheet.create({
  face: { height: tile.height, padding: tile.padding, justifyContent: 'space-between' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: tile.barGap, height: tile.barsHeight },
  bar: { flex: 1, borderRadius: bar.radius, transform: [{ skewX: '-10deg' }] },
});
