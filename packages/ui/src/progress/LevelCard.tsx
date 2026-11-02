'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { levelCard, motion, typeStyle } from '../tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const { ring } = levelCard;
const CIRCUMFERENCE = 2 * Math.PI * ring.radius;

/** One line of the card's words, beside the ring. */
export interface LevelCardLine {
  readonly testID: string;
  readonly text: string;
}

/**
 * The Profile's Level card: an ink card with a red wedge, the Level's number
 * inside a red ring that fills to `progress` of `toNext`, and the card's
 * lines beside it, the first one loud. The ring fills as the card shows;
 * under Reduce Motion it is drawn full at once.
 */
export function LevelCard({
  level,
  progress,
  toNext,
  lines,
  testID,
}: {
  level: number;
  progress: number;
  toNext: number;
  lines: readonly LevelCardLine[];
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  // The top Level has nothing left to reach, so its ring is full.
  const share = toNext > 0 ? Math.min(progress / toNext, 1) : 1;
  const filled = useSharedValue(reduceMotion ? share : 0);
  useEffect(() => {
    filled.value = reduceMotion
      ? share
      : withTiming(share, {
          duration: motion.ring.duration,
          easing: Easing.bezier(...motion.ring.easing),
          reduceMotion: ReduceMotion.Never,
        });
  }, [filled, share, reduceMotion]);
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - filled.value),
  }));
  const ink = colors.background;

  return (
    <View testID={testID} style={[styles.card, { backgroundColor: colors.ink }]}>
      <Wedge
        points={levelCard.wedgeShape}
        color={colors.accent}
        width={levelCard.wedge.side}
        height={levelCard.wedge.side}
        style={styles.wedge}
      />
      <View style={styles.ring}>
        <Svg width={ring.box} height={ring.box} style={styles.turned}>
          <Circle
            cx={ring.box / 2}
            cy={ring.box / 2}
            r={ring.radius}
            fill="none"
            stroke={ring.track}
            strokeWidth={ring.stroke}
          />
          <AnimatedCircle
            cx={ring.box / 2}
            cy={ring.box / 2}
            r={ring.radius}
            fill="none"
            stroke={colors.accent}
            strokeWidth={ring.stroke}
            strokeDasharray={CIRCUMFERENCE}
            animatedProps={ringProps}
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.centre]}>
          <Text
            testID={testID === undefined ? undefined : `${testID}-number`}
            maxFontSizeMultiplier={1}
            style={[
              typeStyle('screenTitle', tokens),
              styles.number,
              { color: ink, fontSize: levelCard.levelSize, lineHeight: levelCard.levelSize },
            ]}
          >
            {String(level)}
          </Text>
        </View>
      </View>
      <View style={styles.lines}>
        {lines.map((line, index) => (
          <Text
            {...voice}
            key={line.testID}
            testID={line.testID}
            style={[
              index === 0 ? typeStyle('heading', tokens) : typeStyle('sub', tokens),
              { color: ink },
            ]}
          >
            {line.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: levelCard.gap,
    padding: levelCard.padding,
    borderRadius: levelCard.radius,
    overflow: 'hidden',
  },
  wedge: {
    position: 'absolute',
    right: levelCard.wedge.right,
    bottom: levelCard.wedge.bottom,
    opacity: levelCard.wedge.opacity,
  },
  ring: { width: ring.box, height: ring.box, flex: 0 },
  turned: { transform: [{ rotate: '-90deg' }] },
  centre: { alignItems: 'center', justifyContent: 'center' },
  number: { letterSpacing: 0 },
  lines: { flex: 1, minWidth: 0, gap: levelCard.linesGap },
});
