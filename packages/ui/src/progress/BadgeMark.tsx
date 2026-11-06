import type { BadgeShape, BadgeTone, ColorTokens } from '@slovo/contracts';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';

import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { badgeMark, badgeStamp, badgeTile, roleAt, typeStyle, wedges, type Wedge } from '../tokens';

/** The outline of each Badge family shape; `circle` is drawn as a circle. */
const outlines: Record<Exclude<BadgeShape, 'circle'>, Wedge> = {
  hexagon: wedges.hexagon,
  shield: wedges.shield,
  tile: badgeTile,
  wedge: wedges.wedge,
  diamond: wedges.diamond,
};

/** The shape drawn in `fill` over a box of `size`, shrunk about its centre by `inset` of the side on each edge. */
function Shape({
  shape,
  size,
  fill,
  inset = 0,
}: {
  shape: BadgeShape;
  size: number;
  fill: string;
  inset?: number;
}) {
  const scale = 1 - 2 * inset;
  const at = (value: number) => String(0.5 + (value - 0.5) * scale);
  return (
    <Svg width={size} height={size} viewBox="0 0 1 1">
      {shape === 'circle' ? (
        <Circle cx={0.5} cy={0.5} r={0.5 * scale} fill={fill} />
      ) : (
        <Polygon
          points={outlines[shape].map(([x, y]) => `${at(x)},${at(y)}`).join(' ')}
          fill={fill}
        />
      )}
    </Svg>
  );
}

/** The ring, face and symbol colours of an earned mark in each tone; red faces carry the light Theme's ink in both Themes. */
function toneColors(tone: BadgeTone, colors: ColorTokens, key: ColorTokens) {
  switch (tone) {
    case 'red':
      return { ring: key.ink, face: colors.accent, symbol: key.ink };
    case 'ink':
      return { ring: colors.accent, face: key.ink, symbol: key.background };
    case 'cream':
      return { ring: key.ink, face: key.background, symbol: key.ink };
  }
}

/**
 * A Badge as its family's mark: earned, its `shape` in the ring of its
 * `tone` with the face set inside and its symbol, over a drop shadow (4 deep
 * above a side of 40, 2 at 40 and below); not yet, a dark silhouette of the
 * shape with no symbol. `onRed` draws an earned Badge for a red ground:
 * cream in an ink ring over a deeper ink drop. The symbol carries the test ID
 * `${testID}-symbol`.
 */
export function BadgeMark({
  shape,
  tone,
  symbol,
  earned,
  size,
  onRed = false,
  testID,
}: {
  shape: BadgeShape;
  tone: BadgeTone;
  symbol: string;
  earned: boolean;
  /** The side of the square the shape fills. */
  size: number;
  onRed?: boolean;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const symbolSize = size / 3;
  const key = useSchemeColors('light');
  const drop = onRed
    ? badgeStamp.drop
    : size > badgeMark.drop.over
      ? badgeMark.drop.large
      : badgeMark.drop.small;
  const {
    ring,
    face,
    symbol: symbolColor,
  } = onRed
    ? { ring: key.ink, face: key.background, symbol: key.ink }
    : toneColors(tone, colors, key);
  return (
    <View
      testID={testID}
      style={[styles.mark, { width: size, height: size + (earned ? drop : 0) }]}
    >
      {earned && (
        <View style={[styles.layer, { top: drop }]}>
          <Shape shape={shape} size={size} fill={key.ink} />
        </View>
      )}
      <View style={styles.layer}>
        <Shape shape={shape} size={size} fill={earned ? ring : colors.silhouette} />
      </View>
      {earned && (
        <View style={styles.layer}>
          <Shape shape={shape} size={size} fill={face} inset={badgeMark.ring} />
        </View>
      )}
      {earned && (
        <View style={[styles.symbol, { width: size, height: size }]}>
          <Text
            testID={testID === undefined ? undefined : `${testID}-symbol`}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              typeStyle('badgeSymbol', tokens),
              {
                color: symbolColor,
                ...roleAt('badgeSymbol', symbolSize),
              },
            ]}
          >
            {symbol}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { position: 'relative' },
  layer: { position: 'absolute', left: 0, top: 0 },
  symbol: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
});
