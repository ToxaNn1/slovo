import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Ellipse, Pattern, Circle, Polygon } from 'react-native-svg';

import { PressedTile } from '../primitives/PressedTile';
import { TileShape } from '../primitives/TileShape';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { mixCoverPictograms, mixScreenDrawing, typeStyle, withAlpha } from '../tokens';

const { cover } = mixScreenDrawing;
const diamond = [
  [0.5, 0],
  [1, 0.5],
  [0.5, 1],
  [0, 0.5],
] as const;

/**
 * A cover's look: the sunken surface with a red pictogram, red with a cream
 * one, ink with a red one, or `quiet`, the light ink with a cream pictogram
 * and no small shape, for a quiet Category.
 */
export type MixCoverTone = 'tile' | 'red' | 'ink' | 'quiet';

/** The covers' tones by position in a group, as the board turns them. */
export function coverToneAt(place: number): Exclude<MixCoverTone, 'quiet'> {
  return (['tile', 'red', 'ink'] as const)[place % 3] ?? 'tile';
}

/**
 * A Category's cover on «Мої Теми» (board XMix, variant E): a picture of its
 * pictogram over a halftone spot with an offset shadow, its small shape and
 * a check box in the corner, its name under the picture in a box of two
 * lines, so the covers of a group are one height. The pictogram is the
 * board's for the Category's `place` among the Edition's Categories; the
 * small shape is a diamond, or a circle for every second cover of a group
 * (`inGroup`). While the Category is out of the Mix the picture fades to
 * grey and the box empties. A press turns it on or off; a disabled cover,
 * the last Category in the Mix, takes no press and reads its hint to
 * VoiceOver. `size` is the group's: big covers in two columns, small ones
 * in three.
 */
export const MixCategoryCover = memo(function MixCategoryCover({
  name,
  place,
  inGroup,
  tone,
  size,
  on,
  disabled = false,
  accessibilityHint,
  onPress,
  testID,
}: {
  name: string;
  place: number;
  inGroup: number;
  tone: MixCoverTone;
  size: 'two' | 'three';
  on: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  onPress: () => void;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const light = useSchemeColors('light');
  const box = cover[size];
  const look = {
    tile: {
      ground: colors.surfaceSunken,
      glyph: colors.accent,
      shadow: colors.ink,
      dot: withAlpha(colors.accent, 0.6),
    },
    red: {
      ground: colors.accent,
      glyph: light.background,
      shadow: light.ink,
      dot: withAlpha(light.ink, 0.35),
    },
    // The board's ink ground is the same dark in both Themes, as the red one is the same red.
    ink: {
      ground: light.ink,
      glyph: colors.accent,
      shadow: light.background,
      dot: withAlpha(colors.accent, 0.65),
    },
    quiet: {
      ground: light.ink,
      glyph: light.background,
      shadow: withAlpha(light.background, 0.2),
      dot: 'transparent',
    },
  }[on ? tone : 'tile'];
  const off = on ? undefined : { glyph: colors.muted, shadow: colors.silhouette };
  const glyph = off?.glyph ?? look.glyph;
  const shadow = off?.shadow ?? look.shadow;
  const dotsId = `${testID}-dots`;
  const pictogram = mixCoverPictograms[place % mixCoverPictograms.length];
  const accent = pictogram?.accent;
  const accentSide = accent?.big === true ? box.bigSmall : box.small;
  const nameType = typeStyle(size === 'two' ? 'mixCoverName' : 'mixCoverNameSmall', tokens);
  return (
    <PressedTile
      testID={testID}
      tone="tile"
      radius={cover.radius}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={name}
      accessibilityHint={disabled ? accessibilityHint : undefined}
      accessibilityState={{ selected: on, disabled }}
      faceStyle={styles.face}
    >
      <View
        style={[
          styles.picture,
          { height: box.height, backgroundColor: look.ground, opacity: on ? 1 : cover.offAlpha },
        ]}
      >
        {tone !== 'quiet' && (
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <Pattern id={dotsId} width={5} height={5} patternUnits="userSpaceOnUse">
                <Circle cx={2.5} cy={2.5} r={1.3} fill={on ? look.dot : colors.silhouette} />
              </Pattern>
            </Defs>
            <Ellipse cx="50%" cy="79%" rx="34%" ry="12%" fill={`url(#${dotsId})`} />
          </Svg>
        )}
        {pictogram !== undefined && (
          <View
            pointerEvents="none"
            style={[
              styles.glyph,
              {
                width: box.glyph,
                height: box.glyph,
                top: box.height * cover.glyphMiddle - box.glyph / 2,
                marginLeft: -box.glyph / 2,
              },
            ]}
          >
            <TileShape
              shape={pictogram.glyph}
              color={shadow}
              place={{ side: box.glyph, right: -cover.shadowOffset, top: cover.shadowOffset }}
            />
            <TileShape
              shape={pictogram.glyph}
              color={glyph}
              place={{ side: box.glyph, right: 0, top: 0 }}
            />
          </View>
        )}
        {tone !== 'quiet' && accent !== undefined && (
          <View
            pointerEvents="none"
            style={[
              styles.small,
              {
                left: `${String(accent.left * 100)}%`,
                top: `${String(accent.top * 100)}%`,
                width: accentSide,
                height: accentSide,
                transform: [{ rotate: `${String(accent.rotate)}deg` }],
              },
            ]}
          >
            {accent.big || inGroup % 2 === 1 ? (
              <TileShape
                shape="circle"
                color={glyph}
                place={{ side: accentSide, right: 0, top: 0 }}
              />
            ) : (
              <Wedge points={diamond} color={glyph} width={accentSide} height={accentSide} />
            )}
          </View>
        )}
        <View
          testID={`${testID}-check`}
          style={[
            styles.check,
            on
              ? { backgroundColor: colors.accent }
              : {
                  backgroundColor: cover.check.emptyFill,
                  borderWidth: cover.check.border,
                  borderColor: light.ink,
                },
          ]}
        >
          {on && (
            <Svg
              width={cover.check.mark.width}
              height={cover.check.mark.height}
              viewBox="0 0 26 22"
            >
              <Polygon points="0,12 4,8 10,14 22,0 26,4 10,22" fill={light.ink} />
            </Svg>
          )}
        </View>
      </View>
      <Text
        {...voice}
        style={[
          nameType,
          {
            color: colors.ink,
            borderTopColor: colors.ink,
            paddingHorizontal: box.name.x,
            paddingTop: box.name.top,
            paddingBottom: box.name.bottom,
            minHeight: cover.nameRule + box.name.top + 2 * nameType.lineHeight + box.name.bottom,
          },
          styles.name,
        ]}
      >
        {name}
      </Text>
    </PressedTile>
  );
});

const styles = StyleSheet.create({
  face: { overflow: 'hidden' },
  picture: { overflow: 'hidden' },
  glyph: { position: 'absolute', left: '50%' },
  small: { position: 'absolute' },
  check: {
    position: 'absolute',
    top: cover.check.inset,
    right: cover.check.inset,
    width: cover.check.side,
    height: cover.check.side,
    borderRadius: cover.check.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { borderTopWidth: cover.nameRule },
});
