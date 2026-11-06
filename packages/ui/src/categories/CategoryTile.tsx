import { StyleSheet, Text, View, type DimensionValue } from 'react-native';

import { PressedTile } from '../primitives/PressedTile';
import { TileShape, type TileShapeKind, type TileShapePlace } from '../primitives/TileShape';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { categoryTile, typeStyle, withAlpha, type TypeRole } from '../tokens';

/** One shape of a Category tile's pictogram. */
export type CategoryShape = TileShapeKind;

/**
 * A Category tile's tone, from the boards: `red` (ink name, cream big shape,
 * ink small one), `ink` (background name, red big shape, background small
 * one) or `tile`, the sunken surface (ink name, red big shape, ink small one).
 * A quiet Category's tile is muted (ADR 0081): `quietGrid` in k1, the sunken
 * surface with its name and both shapes in muted ink, and `quietRail` on the
 * home board's rail, the light theme's ink in both themes with its name in the
 * light background, a faint big shape and no small one.
 */
export type CategoryTone = 'red' | 'ink' | 'tile' | 'quietGrid' | 'quietRail';

/** The boards' tones by position: red, ink and the sunken surface in turn. */
export function toneByPosition(index: number): CategoryTone {
  const tones = ['red', 'ink', 'tile'] as const;
  return tones[index % tones.length] ?? 'red';
}

/** A tile's box from the board it is drawn on: the rail's or a grid's. */
export interface CategoryTileBox {
  readonly width?: DimensionValue;
  readonly height: number;
  readonly radius: number;
  readonly padding: number;
  readonly big: TileShapePlace;
  readonly small: TileShapePlace;
  /** The type role of the name. */
  readonly name: TypeRole;
}

/**
 * A Category's tile, as the home board's rail and the k1 grid draw it: its
 * name at the bottom under a two-shape pictogram, in its tone. A tap opens
 * the Category; VoiceOver reads its name.
 */
export function CategoryTile({
  name,
  accessibilityLabel = name,
  tone,
  shapes: [big, small],
  box,
  onPress,
  testID,
}: {
  name: string;
  /** What VoiceOver reads for the tile; its name unless given. */
  accessibilityLabel?: string;
  tone: CategoryTone;
  shapes: readonly [CategoryShape, CategoryShape];
  box: CategoryTileBox;
  onPress: () => void;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const light = useSchemeColors('light');
  const { voice } = useEdition();
  const look = {
    red: { ground: colors.accent, text: light.ink, big: light.background, small: light.ink },
    ink: {
      ground: colors.ink,
      text: colors.background,
      big: colors.accent,
      small: colors.background,
    },
    tile: { ground: colors.surfaceSunken, text: colors.ink, big: colors.accent, small: colors.ink },
    quietGrid: {
      ground: colors.surfaceSunken,
      text: colors.muted,
      big: colors.muted,
      small: colors.muted,
    },
    quietRail: {
      ground: light.ink,
      text: light.background,
      big: withAlpha(light.background, categoryTile.quietShapeAlpha),
      small: 'transparent',
    },
  }[tone];
  return (
    <View style={{ width: box.width }}>
      <PressedTile
        testID={testID}
        tone="none"
        radius={box.radius}
        accessibilityLabel={accessibilityLabel}
        accessibilityLanguage={voice.accessibilityLanguage}
        onPress={onPress}
        faceStyle={[
          styles.face,
          { height: box.height, padding: box.padding, backgroundColor: look.ground },
        ]}
      >
        <TileShape shape={big} color={look.big} place={box.big} />
        <TileShape shape={small} color={look.small} place={box.small} />
        <Text
          {...voice}
          testID={`${testID}-name`}
          android_hyphenationFrequency="full"
          style={[typeStyle(box.name, tokens), { color: look.text }]}
        >
          {name}
        </Text>
      </PressedTile>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { justifyContent: 'flex-end', overflow: 'hidden' },
});
