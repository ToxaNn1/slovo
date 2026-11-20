import { StyleSheet, Text, View, type DimensionValue } from 'react-native';

import { PressedTile } from '../primitives/PressedTile';
import { WholeWordsText } from '../primitives/WholeWordsText';
import {
  shapeAt,
  TileShape,
  type TileShapeKind,
  type TileShapePair,
  type TileShapePlace,
} from '../primitives/TileShape';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { categoryTile, typeStyle, withAlpha, type TypeRole } from '../tokens';

/** One shape of a Category tile's pictogram. */
export type CategoryShape = TileShapeKind;

/**
 * A Category tile's tone, from the boards: `red` (ink name, cream big shape,
 * ink small one), `ink` (background name, red big shape, background small
 * one) or `tile`, the sunken surface (ink name, red big shape, ink small one).
 * A quiet Category has a quiet tile: `quietGrid` in k1, the sunken
 * surface with its name and both shapes in muted ink, and `quietRail` on the
 * Dashboard's rail, the light theme's ink in both themes with its name in the
 * light background, a faint big shape and no small one.
 */
export type CategoryTone = 'red' | 'ink' | 'tile' | 'quietGrid' | 'quietRail';

/** The boards' tones by position: red, ink and the sunken surface in turn. */
export function toneByPosition(index: number): CategoryTone {
  const tones = ['red', 'ink', 'tile'] as const;
  return tones[index % tones.length] ?? 'red';
}

/** A tile's pair of shapes, its big one and its small one. */
export type CategoryShapes = TileShapePair;

export { shapeAt };

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
 * A Category's tile, as the Dashboard's rail and the k1 grid draw it: its
 * name at the bottom under a two-shape pictogram, in its tone. A tap opens
 * the Category; VoiceOver reads its name. The «SLOVO пропонує» rail draws its
 * Curated Collections with it too, with a count under the name
 * and a mark in the top corner; without shapes it draws no pictogram.
 */
export function CategoryTile({
  name,
  accessibilityLabel = name,
  tone,
  shapes,
  count,
  mark,
  box,
  onPress,
  testID,
}: {
  name: string;
  /** What VoiceOver reads for the tile; its name unless given. */
  accessibilityLabel?: string;
  tone: CategoryTone;
  shapes: readonly [CategoryShape, CategoryShape] | undefined;
  /** A line under the name, such as a Curated Collection's count of Entries. */
  count?: string | undefined;
  /** A small mark in the top corner, such as «Нова». */
  mark?: string | undefined;
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
        {shapes !== undefined && (
          <>
            <TileShape shape={shapes[0]} color={look.big} place={box.big} />
            <TileShape shape={shapes[1]} color={look.small} place={box.small} />
          </>
        )}
        {mark !== undefined && (
          <Text
            {...voice}
            testID={`${testID}-mark`}
            style={[
              styles.mark,
              { left: box.padding, top: box.padding },
              typeStyle('labelChip', tokens),
              { color: look.text },
            ]}
          >
            {mark}
          </Text>
        )}
        <WholeWordsText
          {...voice}
          testID={`${testID}-name`}
          text={name}
          typeRole={box.name}
          style={[typeStyle(box.name, tokens), { color: look.text }]}
        />
        {count !== undefined && (
          <Text
            {...voice}
            testID={`${testID}-count`}
            style={[styles.count, typeStyle('categoryCount', tokens), { color: look.text }]}
          >
            {count}
          </Text>
        )}
      </PressedTile>
    </View>
  );
}

const styles = StyleSheet.create({
  face: { justifyContent: 'flex-end', overflow: 'hidden' },
  mark: { position: 'absolute' },
  count: { marginTop: categoryTile.countGap, opacity: categoryTile.countOpacity },
});
