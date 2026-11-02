import type { BadgeCondition } from '@slovo/contracts';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';

import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { badgeEdge, badgeStamp, typeRoles, typeStyle, wedges, type Wedge } from '../tokens';

/** The shape of a Badge family: the Streak, the Games, the confirmed Entries, the Levels. */
export type BadgeShape = Wedge | 'circle';

/** Each Badge family's own shape, read from the kind of its condition. */
export function shapeOf(kind: BadgeCondition['kind']): BadgeShape {
  switch (kind) {
    case 'streak':
      return wedges.hexagon;
    case 'confirmedEntries':
      return wedges.shield;
    case 'level':
      return wedges.diamond;
    case 'gameWin':
    case 'dailyCrosswordRun':
    case 'rightAnswers':
    case 'rightOnRarity':
      return 'circle';
  }
}

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
 * A Badge as its family's shape: earned, red with its symbol over a hard
 * edge; not yet, a dark silhouette with no symbol. `onRed` draws an earned
 * Badge for a red ground: cream over a deeper ink edge. The symbol carries
 * the test ID `${testID}-symbol`.
 */
export function BadgeMark({
  condition,
  symbol,
  earned,
  size,
  onRed = false,
  testID,
}: {
  condition: BadgeCondition;
  symbol: string;
  earned: boolean;
  /** The side of the square the shape fills. */
  size: number;
  onRed?: boolean;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const symbolRole = typeRoles.badgeSymbol;
  const symbolSize = size / 3;
  // The symbol on red is the ink of the light Theme in both Themes, as on every red face.
  const key = useSchemeColors('light');
  const keyInk = key.ink;
  const shape = shapeOf(condition.kind);
  const edge = onRed ? badgeStamp.drop : badgeEdge;
  const face = onRed ? key.background : colors.accent;
  return (
    <View
      testID={testID}
      style={[styles.mark, { width: size, height: size + (earned ? edge : 0) }]}
    >
      {earned && (
        <View style={[styles.layer, { top: edge }]}>
          <Shape shape={shape} size={size} fill={onRed ? keyInk : colors.accentEdge} />
        </View>
      )}
      <View style={styles.layer}>
        <Shape shape={shape} size={size} fill={earned ? face : colors.silhouette} />
      </View>
      {earned && (
        <View style={[styles.symbol, { width: size, height: size }]}>
          <Text
            testID={testID === undefined ? undefined : `${testID}-symbol`}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              typeStyle('badgeSymbol', tokens),
              {
                color: keyInk,
                fontSize: symbolSize,
                lineHeight: (symbolSize * symbolRole.lineHeight) / symbolRole.size,
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
