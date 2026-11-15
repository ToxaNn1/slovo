import type { BadgeShape, BadgeTone, ColorTokens } from '@slovo/contracts';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import {
  badgeChecker,
  badgeCheckerFace,
  badgeMark,
  badgeNewTag,
  badgeStamp,
  badgeTile,
  badgeWedge,
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
  wedge: badgeWedge,
  diamond: wedges.diamond,
  checker: badgeChecker,
};

/** The SVG path of `shape` in the unit box, shrunk about its centre by `inset` of the side on each edge. */
function outline(shape: BadgeShape, inset: number) {
  const scale = 1 - 2 * inset;
  if (shape === 'circle') {
    const r = String(0.5 * scale);
    return `M${String(inset)},0.5 a${r},${r} 0 1,0 ${String(scale)},0 a${r},${r} 0 1,0 ${String(-scale)},0 Z`;
  }
  const at = (value: number) => String(0.5 + (value - 0.5) * scale);
  return `M${outlines[shape].map(([x, y]) => `${at(x)},${at(y)}`).join(' L')} Z`;
}

/**
 * The shape drawn in `fill` over a box of `size`, shrunk about its centre by
 * `inset` of the side on each edge; with a `hole`, only the band outside the
 * shape shrunk by `hole`.
 */
function Shape({
  shape,
  size,
  fill,
  inset = 0,
  hole,
  opacity = 1,
  testID,
}: {
  shape: BadgeShape;
  size: number;
  fill: string;
  inset?: number;
  hole?: number;
  opacity?: number;
  testID?: string | undefined;
}) {
  const d =
    hole === undefined ? outline(shape, inset) : `${outline(shape, inset)} ${outline(shape, hole)}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 1 1">
      <Path
        {...(testID === undefined ? {} : { testID })}
        d={d}
        fill={fill}
        fillOpacity={opacity}
        fillRule="evenodd"
      />
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

/**
 * The ring, face, symbol and drop colours of an earned mark in each tone
 * (`XBadges`): the ink face takes the Theme's ink, so it turns cream in the
 * dark Theme; red and cream faces carry the light Theme's ink in both Themes.
 */
function toneColors(tone: BadgeTone, colors: ColorTokens, key: ColorTokens) {
  switch (tone) {
    case 'red':
      return { ring: colors.accentEdge, face: colors.accent, symbol: key.ink, drop: key.ink };
    case 'ink':
      return {
        ring: colors.accent,
        face: colors.ink,
        symbol: colors.accent,
        drop: colors.accentEdge,
      };
    case 'cream':
      return { ring: key.ink, face: key.background, symbol: key.ink, drop: key.ink };
  }
}

/**
 * The state a Badge's mark draws (`XBadges`): not started, its shape in two
 * greys; in progress, the same with its face filled from the bottom by
 * `fraction` (above 0, below 1); earned, new («НОВА») until the reader opens it.
 */
export type BadgeMarkState =
  | { readonly kind: 'locked' }
  | { readonly kind: 'progress'; readonly fraction: number }
  | { readonly kind: 'earned'; readonly isNew: boolean };

/**
 * A Badge as its family's mark, its `shape` at every size (`XBadges`, ADR 0145).
 * Locked: a ring in `silhouette` round a face half as dark, no symbol. In
 * progress: the same, the face (inside the ring only, test ID
 * `${testID}-progress`) filling from the bottom in half-transparent red by its
 * fraction. Earned: the shape in the ring of its `tone` with the face set
 * inside (test ID `${testID}-face`) and its symbol, over a drop shadow (4 deep
 * above a side of 40, 2 at 40 and below), and while new the ink «НОВА» tag
 * turned over its corner. An earned `checker` Badge shows its red and ink
 * checker in place of the symbol, test ID `${testID}-checker`. `onRed` draws
 * an earned Badge for a red ground: cream in an ink ring over a deeper ink
 * drop, its tag cream. The symbol carries the test ID `${testID}-symbol`, the
 * tag `${testID}-new`.
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
  const part = (name: string) => (testID === undefined ? undefined : `${testID}-${name}`);
  const { ring } = badgeMark;
  if (state.kind !== 'earned') {
    const face = size * (1 - 2 * ring);
    const filled = state.kind === 'progress' ? Math.round(face * state.fraction) : 0;
    const top = size * ring + face - filled;
    const left = size * ring;
    return (
      <View testID={testID} style={[styles.mark, { width: size, height: size }]}>
        <View style={styles.layer}>
          <Shape shape={shape} size={size} fill={colors.silhouette} hole={ring} />
        </View>
        <View style={styles.layer}>
          <Shape
            shape={shape}
            size={size}
            fill={colors.silhouette}
            inset={ring}
            opacity={badgeMark.lockedFace}
          />
        </View>
        {filled > 0 && (
          <View
            testID={part('progress')}
            style={[styles.fill, { left, top, width: face, height: filled }]}
          >
            <View style={[styles.layer, { left: -left, top: -top }]}>
              <Shape
                shape={shape}
                size={size}
                fill={colors.accent}
                inset={ring}
                opacity={badgeMark.progress}
              />
            </View>
          </View>
        )}
      </View>
    );
  }
  const depth = onRed
    ? badgeStamp.drop
    : size > badgeMark.drop.over
      ? badgeMark.drop.large
      : badgeMark.drop.small;
  const paint = onRed
    ? { ring: keyInk, face: key.background, symbol: keyInk, drop: keyInk }
    : toneColors(tone, colors, key);
  return (
    <View testID={testID} style={[styles.mark, { width: size, height: size + depth }]}>
      <View style={[styles.layer, { top: depth }]}>
        <Shape shape={shape} size={size} fill={paint.drop} />
      </View>
      <View style={styles.layer}>
        <Shape shape={shape} size={size} fill={paint.ring} hole={ring} />
      </View>
      <View style={styles.layer}>
        <Shape shape={shape} size={size} fill={paint.face} inset={ring} testID={part('face')} />
      </View>
      {shape === 'checker' ? (
        <Checker size={size} lead={colors.accent} other={keyInk} testID={part('checker')} />
      ) : (
        <View style={[styles.symbol, { width: size, height: size }]}>
          <Text
            testID={part('symbol')}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              typeStyle('badgeSymbol', tokens),
              { color: paint.symbol, ...roleAt('badgeSymbol', symbolSize) },
            ]}
          >
            {symbol}
          </Text>
        </View>
      )}
      {state.isNew && (
        // The span reaches left past a small mark, so the tag keeps one line.
        <View style={styles.tagSpan} pointerEvents="none">
          <Text
            testID={part('new')}
            {...voice}
            numberOfLines={1}
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
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { position: 'relative' },
  layer: { position: 'absolute', left: 0, top: 0 },
  fill: { position: 'absolute', overflow: 'hidden' },
  symbol: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  tagSpan: {
    position: 'absolute',
    top: badgeNewTag.top,
    right: badgeNewTag.right,
    left: -badgeNewTag.reach,
    alignItems: 'flex-end',
  },
  tag: {
    paddingHorizontal: badgeNewTag.paddingHorizontal,
    paddingVertical: badgeNewTag.paddingVertical,
    transform: [{ rotate: `${String(badgeNewTag.turn)}deg` }],
  },
});
