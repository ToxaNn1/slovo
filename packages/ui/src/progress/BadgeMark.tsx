import type { BadgeShape, BadgeTone, ColorTokens } from '@slovo/contracts';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import {
  badgeChecker,
  badgeCheckerFace,
  badgeMark,
  badgeNewTag,
  badgeStamp,
  badgeTile,
  roleAt,
  typeStyle,
  wedges,
  type Wedge,
} from '../tokens';

/** The outline of each Badge family shape; `circle` is drawn as a circle. */
const outlines: Record<Exclude<BadgeShape, 'circle'>, Wedge> = {
  hexagon: wedges.hexagon,
  shield: wedges.shield,
  tile: badgeTile,
  wedge: wedges.wedge,
  diamond: wedges.diamond,
  checker: badgeChecker,
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

/** The corners of the square of `side` whose top left corner is at `left`, `top`, as SVG points. */
function cellCorners(left: number, top: number, side: number) {
  return [
    [left, top],
    [left + side, top],
    [left + side, top + side],
    [left, top + side],
  ]
    .map(([x, y]) => `${String(x)},${String(y)}`)
    .join(' ');
}

/**
 * The `cells` by `cells` checker a `checker` Badge shows in place of its
 * symbol, its corner cells in `lead` and the others in `other`.
 */
function Checker({
  size,
  lead,
  other,
  testID,
}: {
  size: number;
  lead: string;
  other: string;
  testID: string | undefined;
}) {
  const { cells, side } = badgeCheckerFace;
  const cell = side / cells;
  const start = (1 - side) / 2;
  const squares = Array.from({ length: cells * cells }, (_, index) => ({
    row: Math.floor(index / cells),
    column: index % cells,
  }));
  return (
    <View testID={testID} style={styles.layer}>
      <Svg width={size} height={size} viewBox="0 0 1 1">
        {squares.map(({ row, column }) => (
          <Polygon
            key={`${String(row)}-${String(column)}`}
            points={cellCorners(start + column * cell, start + row * cell, cell)}
            fill={(row + column) % 2 === 0 ? lead : other}
          />
        ))}
      </Svg>
    </View>
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
 * The state a Badge's mark draws (board 10.5, 10.6): not started, a
 * silhouette; in progress, the silhouette filled from the bottom by
 * `fraction` (above 0, below 1); earned, new («НОВА») until the reader opens it.
 */
export type BadgeMarkState =
  | { readonly kind: 'locked' }
  | { readonly kind: 'progress'; readonly fraction: number }
  | { readonly kind: 'earned'; readonly isNew: boolean };

/**
 * A Badge as its family's mark. Locked: a dark silhouette of its `shape` with
 * its symbol muted, so the shape is never empty. In progress: the silhouette
 * fills from the bottom in red by its fraction, the symbol muted. Earned: the shape in the ring of its `tone` with
 * the face set inside and its symbol, over a drop shadow (4 deep above a side
 * of 40, 2 at 40 and below), and while new the ink «НОВА» tag turned over its
 * corner. A `checker` Badge shows its red and ink checker (muted in
 * progress) in place of the symbol, test ID `${testID}-checker`. `onRed` draws an earned Badge for a red ground: cream in an ink ring
 * over a deeper ink drop, its tag cream. The symbol carries the test ID
 * `${testID}-symbol`, the tag `${testID}-new`.
 */
export function BadgeMark({
  shape,
  tone,
  symbol,
  state,
  size,
  onRed = false,
  testID,
}: {
  shape: BadgeShape;
  tone: BadgeTone;
  symbol: string;
  state: BadgeMarkState;
  /** The side of the square the shape fills. */
  size: number;
  onRed?: boolean;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const symbolSize = size / 3;
  const key = useSchemeColors('light');
  const keyInk = key.ink;
  const earned = state.kind === 'earned';
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
    ? { ring: keyInk, face: key.background, symbol: keyInk }
    : toneColors(tone, colors, key);
  const filled = state.kind === 'progress' ? Math.round(size * state.fraction) : 0;
  return (
    <View
      testID={testID}
      style={[styles.mark, { width: size, height: size + (earned ? drop : 0) }]}
    >
      {earned && (
        <View style={[styles.layer, { top: drop }]}>
          <Shape shape={shape} size={size} fill={keyInk} />
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
      {filled > 0 && (
        <View style={[styles.fill, { top: size - filled, width: size, height: filled }]}>
          <View style={[styles.layer, { top: filled - size }]}>
            <Shape shape={shape} size={size} fill={colors.accent} />
          </View>
        </View>
      )}
      {shape === 'checker' && (
        <Checker
          size={size}
          lead={earned ? colors.accent : colors.muted}
          other={earned ? keyInk : 'transparent'}
          testID={testID === undefined ? undefined : `${testID}-checker`}
        />
      )}
      {shape !== 'checker' && (
        <View style={[styles.symbol, { width: size, height: size }]}>
          <Text
            testID={testID === undefined ? undefined : `${testID}-symbol`}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              typeStyle('badgeSymbol', tokens),
              {
                color: earned ? symbolColor : colors.muted,
                ...roleAt('badgeSymbol', symbolSize),
              },
            ]}
          >
            {symbol}
          </Text>
        </View>
      )}
      {earned && state.isNew && (
        <Text
          testID={testID === undefined ? undefined : `${testID}-new`}
          {...voice}
          style={[
            typeStyle('badgeNewTag', tokens),
            styles.tag,
            onRed
              ? { backgroundColor: key.background, color: keyInk }
              : { backgroundColor: colors.ink, color: colors.background },
          ]}
        >
          {strings.settings.badges.newTag}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { position: 'relative' },
  layer: { position: 'absolute', left: 0, top: 0 },
  fill: { position: 'absolute', left: 0, overflow: 'hidden' },
  symbol: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  tag: {
    position: 'absolute',
    top: badgeNewTag.top,
    right: badgeNewTag.right,
    paddingHorizontal: badgeNewTag.paddingHorizontal,
    paddingVertical: badgeNewTag.paddingVertical,
    borderRadius: badgeNewTag.radius,
    overflow: 'hidden',
    transform: [{ rotate: `${String(badgeNewTag.turn)}deg` }],
  },
});
