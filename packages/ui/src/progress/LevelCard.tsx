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
 * over its `label` inside a red ring that fills to `progress` of `toNext`,
 * and beside it the Level's name, loud, over the card's quieter lines. The
 * ring fills as the card shows; under Reduce Motion it is drawn full at once.
 * The number carries the test ID `${testID}-number`, the name `${testID}-name`.
 */
export function LevelCard({
  level,
  label,
  name,
  progress,
  toNext,
  lines,
  testID,
}: {
  level: number;
  /** The word under the number, such as «Рівень». */
  label: string;
  /** The Level's name. */
  name: string;
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
        <View accessible style={[StyleSheet.absoluteFill, styles.centre]} {...voice}>
          <Text
            testID={testID === undefined ? undefined : `${testID}-number`}
            maxFontSizeMultiplier={1}
            style={[typeStyle('levelNumber', tokens), { color: ink }]}
          >
            {String(level)}
          </Text>
          <Text maxFontSizeMultiplier={1} style={[typeStyle('levelLabel', tokens), { color: ink }]}>
            {label}
          </Text>
        </View>
      </View>
      <View style={styles.lines}>
        <Text
          {...voice}
          testID={testID === undefined ? undefined : `${testID}-name`}
          // A Level name is one word: it shrinks to the line rather than break mid-word.
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[typeStyle('levelName', tokens), { color: ink }]}
        >
          {name}
        </Text>
        {lines.map((line, index) => (
          <Text
            {...voice}
            key={line.testID}
            testID={line.testID}
            style={[
              index === 0 ? typeStyle('levelXp', tokens) : typeStyle('meta', tokens),
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
  lines: { flex: 1, minWidth: 0, gap: levelCard.linesGap },
});
