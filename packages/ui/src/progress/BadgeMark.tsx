import type { BadgeCondition } from '@slovo/contracts';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import {
  badgeEdge,
  badgeNewTag,
  badgeStamp,
  roleAt,
  typeStyle,
  wedges,
  type Wedge,
} from '../tokens';

/** A Badge family: the Streak, the Games, the confirmed Entries, the Levels. */
export type BadgeFamily = 'streak' | 'games' | 'entries' | 'levels';

/** The family of a Badge, read from the kind of its condition. */
export function familyOf(kind: BadgeCondition['kind']): BadgeFamily {
  switch (kind) {
    case 'streak':
      return 'streak';
    case 'confirmedEntries':
      return 'entries';
    case 'level':
      return 'levels';
    case 'gameWin':
    case 'dailyCrosswordRun':
    case 'rightAnswers':
    case 'rightOnRarity':
    case 'flawlessGame':
    case 'rightRun':
      return 'games';
  }
}

/** The shape of a Badge family. */
type BadgeShape = Wedge | 'circle';

/** Each Badge family's own shape. */
const shapes: Record<BadgeFamily, BadgeShape> = {
  streak: wedges.hexagon,
  entries: wedges.shield,
  levels: wedges.diamond,
  games: 'circle',
};

/** The shape drawn in `fill` over a box of `size`. */
function Shape({ shape, size, fill }: { shape: BadgeShape; size: number; fill: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1 1">
      {shape === 'circle' ? (
        <Circle cx={0.5} cy={0.5} r={0.5} fill={fill} />
      ) : (
        <Polygon
          points={shape.map(([x, y]) => `${String(x)},${String(y)}`).join(' ')}
          fill={fill}
        />
      )}
    </Svg>
  );
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
 * A Badge as its family's shape. Locked: a two-tone silhouette, its shape
 * over a hard edge of the same tone, with no symbol. In progress: the
 * silhouette fills from the bottom in red by its fraction, the symbol muted.
 * Earned: red with its symbol over a hard edge, and while new the ink «НОВА»
 * tag turned over its corner. `onRed` draws an earned Badge for a red ground:
 * cream over a deeper ink edge, its tag cream. The symbol carries the test ID
 * `${testID}-symbol`, the tag `${testID}-new`.
 */
export function BadgeMark({
  condition,
  symbol,
  state,
  size,
  onRed = false,
  testID,
}: {
  condition: BadgeCondition;
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
  // The symbol on red is the ink of the light Theme in both Themes, as on every red face.
  const key = useSchemeColors('light');
  const keyInk = key.ink;
  const shape = shapes[familyOf(condition.kind)];
  const earned = state.kind === 'earned';
  const edge = onRed ? badgeStamp.drop : badgeEdge;
  const face = onRed ? key.background : colors.accent;
  const filled = state.kind === 'progress' ? Math.round(size * state.fraction) : 0;
  return (
    <View testID={testID} style={[styles.mark, { width: size, height: size + edge }]}>
      <View style={[styles.layer, { top: edge }]}>
        <Shape
          shape={shape}
          size={size}
          fill={earned ? (onRed ? keyInk : colors.accentEdge) : colors.silhouette}
        />
      </View>
      <View style={styles.layer}>
        <Shape shape={shape} size={size} fill={earned ? face : colors.silhouette} />
      </View>
      {filled > 0 && (
        <View style={[styles.fill, { top: size - filled, width: size, height: filled }]}>
          <View style={[styles.layer, { top: filled - size }]}>
            <Shape shape={shape} size={size} fill={colors.accent} />
          </View>
        </View>
      )}
      {state.kind !== 'locked' && (
        <View style={[styles.symbol, { width: size, height: size }]}>
          <Text
            testID={testID === undefined ? undefined : `${testID}-symbol`}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              typeStyle('badgeSymbol', tokens),
              {
                color: earned ? keyInk : colors.muted,
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
