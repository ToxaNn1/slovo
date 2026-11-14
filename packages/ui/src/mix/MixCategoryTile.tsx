import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { PressedTile } from '../primitives/PressedTile';
import { TileShape, type TileShapeKind } from '../primitives/TileShape';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { mixTileDrawing as drawing, typeStyle } from '../tokens';

const { corner, check, glyph } = drawing;

/** The check corner: a triangle in the tile's top right corner. */
const CORNER = [
  [0, 0],
  [1, 0],
  [1, 1],
] as const;

/**
 * A Category's tile of the Mix (board 11, screen 87): the Category's
 * pictogram in its square and its name, ink while the Category is in the
 * Mix, with a red pictogram square and a ✓ in its corner, the plain tile
 * while it is out. A press turns it on or off. A disabled tile, the last
 * Category in the Mix, is dimmed, takes no press and reads its hint to
 * VoiceOver. VoiceOver reads it by its `name` unless `accessibilityLabel`
 * names it otherwise.
 */
export function MixCategoryTile({
  name,
  accessibilityLabel = name,
  glyph: shape,
  on,
  disabled = false,
  accessibilityHint,
  onPress,
  testID,
}: {
  name: string;
  accessibilityLabel?: string;
  /** The big shape of the Category's pictogram. */
  glyph: TileShapeKind;
  on: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  onPress: () => void;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  // The board's dark ink on red, in either Theme.
  const onRed = useSchemeColors('light').ink;
  return (
    <PressedTile
      testID={testID}
      tone={on ? 'inverse' : 'tile'}
      radius={drawing.radius}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={disabled ? accessibilityHint : undefined}
      accessibilityState={{ selected: on, disabled }}
      faceStyle={styles.face}
    >
      <View
        style={[styles.pictogram, { backgroundColor: on ? colors.accent : colors.surfaceSunken }]}
      >
        <TileShape
          shape={shape}
          color={on ? onRed : colors.muted}
          place={{
            side: glyph,
            right: (drawing.pictogram - glyph) / 2,
            top: (drawing.pictogram - glyph) / 2,
          }}
        />
      </View>
      <Text
        {...voice}
        style={[
          typeStyle('mixTileName', tokens),
          styles.name,
          { color: on ? colors.background : colors.ink },
        ]}
      >
        {name}
      </Text>
      {on && (
        <View testID={testID === undefined ? undefined : `${testID}-check`} style={styles.corner}>
          <Wedge points={CORNER} color={colors.accent} width={corner} height={corner} />
          <Svg width={check.width} height={check.height} viewBox="0 0 26 22" style={styles.check}>
            <Polygon points="0,12 4,8 10,14 22,0 26,4 10,22" fill={onRed} />
          </Svg>
        </View>
      )}
    </PressedTile>
  );
}

const styles = StyleSheet.create({
  face: {
    minHeight: drawing.minHeight,
    padding: drawing.padding,
    paddingRight: drawing.paddingRight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: drawing.gap,
    overflow: 'hidden',
  },
  pictogram: {
    width: drawing.pictogram,
    height: drawing.pictogram,
    borderRadius: drawing.pictogramRadius,
  },
  name: { flex: 1, minWidth: 0 },
  corner: { position: 'absolute', top: 0, right: 0, width: corner, height: corner },
  check: { position: 'absolute', top: check.inset, right: check.inset },
});
