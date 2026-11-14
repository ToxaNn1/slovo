'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path, Polygon } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useReduceMotionKnown } from '../providers/useReduceMotion';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { goalReachedCard as card, motion, typeStyle } from '../tokens';
import { HalftoneGround } from '../primitives/HalftoneGround';
import { Mascot } from '../primitives/Mascot';
import { REDUCED_FADE, bezierFn } from '../primitives/timing';
import { useIsPageOnScreen, useTurnToNextPage } from '../primitives/VerticalPager';

/** The most Word plates the card shows before «+ ще …» takes the last place. */
const PLATES = 3;

const { enter } = card;
const cardEase = bezierFn(enter.card.easing);
const bandEase = bezierFn(enter.band.easing);
const titleEase = bezierFn(enter.title.easing);
const wordEase = bezierFn(enter.words.easing);
const mascotEase = bezierFn(enter.mascot.easing);
const shardEase = bezierFn(enter.shards.easing);
const riseEase = bezierFn(motion.cascade.easing);

/** When the last part of the entrance comes to rest, in ms from the card's mount. */
const ENTERED = Math.max(
  enter.card.delay + enter.card.duration,
  enter.band.delay + enter.band.duration,
  enter.title.delay + enter.title.duration,
  enter.words.delay + (PLATES - 1) * enter.words.stagger + enter.words.duration,
  enter.mascot.delay + enter.mascot.duration,
  enter.shards.delay +
    (enter.shards.flights.length - 1) * enter.shards.stagger +
    enter.shards.duration,
  ...Object.values(enter.cascade).map((wait) => wait + motion.cascade.duration),
);

/** How far a part of the entrance is through its motion, from 0 to 1, `clock` ms in. */
function through(clock: number, delay: number, duration: number) {
  'worklet';
  return Math.min(Math.max((clock - delay) / duration, 0), 1);
}

/** The share of the card still covered from its top, `clock` ms in (`fgIn`). */
function covered(clock: number) {
  'worklet';
  const { delay, duration, edge, top } = enter.card;
  return Math.max(edge + (top - edge) * cardEase(through(clock, delay, duration)), 0);
}

/**
 * The entrance's clock, in ms from its start, and how much of the card shows:
 * the clock runs once the page is on screen and the system has answered on
 * Reduce Motion. Under Reduce Motion it stands at the end, so nothing moves,
 * and the card only fades in (ADR 0055).
 */
function useEntranceClock(): {
  clock: SharedValue<number>;
  shown: SharedValue<number>;
  still: boolean;
} {
  const reduceMotion = useReduceMotionKnown();
  const onScreen = useIsPageOnScreen();
  const clock = useSharedValue(reduceMotion === true ? ENTERED : 0);
  const shown = useSharedValue(reduceMotion === true ? 0 : 1);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    if (reduceMotion === true) {
      started.current = true;
      clock.value = ENTERED;
      shown.value = 0;
      shown.value = withTiming(1, REDUCED_FADE);
    } else if (reduceMotion === false && onScreen) {
      started.current = true;
      clock.value = withTiming(ENTERED, {
        duration: ENTERED,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      });
    }
  }, [reduceMotion, onScreen, clock, shown]);
  return { clock, shown, still: reduceMotion === true };
}

/** A part that rises into place as a cascade (`slCasc`), `wait` ms into the entrance. */
function useRise(clock: SharedValue<number>, wait: number) {
  return useAnimatedStyle(() => {
    const eased = riseEase(through(clock.value, wait, motion.cascade.duration));
    return {
      opacity: eased,
      transform: [{ translateY: (1 - eased) * motion.cascade.rise }],
    };
  });
}

/**
 * «Ціль дня виконано!» (ADR 0129): the red card of the day's Daily Goal met,
 * its plate with the goal, the first Words Seen today, the celebrating
 * Mascot and the Streak, or no Streak while the reader doesn't see it. The
 * button turns to the next card as a swipe would, and so closes the card.
 * It keeps the design's colours in both schemes, as the design draws it.
 */
export function GoalReachedCard({
  goal,
  words,
  streak,
}: {
  /** The Words Seen the day's Daily Goal asked for. */
  goal: number;
  /** The Lemmas of the first Words Seen today, in the order Seen. */
  words: readonly string[];
  /** The Streak, or undefined while the reader doesn't see it. */
  streak: number | undefined;
}) {
  const { strings, count, voice } = useEdition();
  const tokens = useTokens();
  const { accentEdge, background: cream, ink } = useSchemeColors('light');
  const {
    label,
    plate,
    title,
    message,
    collected,
    more,
    streak: streakLabel,
    next,
  } = strings.feedNotices.goalReached;
  const turnToNext = useTurnToNextPage();
  const [size, setSize] = useState<{ width: number; height: number }>();
  const { clock, shown, still } = useEntranceClock();
  const height = size?.height ?? 0;
  // The card rises past its place and settles, each leg on the curve, as it
  // is uncovered from its foot up: the frame drops by the hidden part and its
  // inside lifts by as much, so only the uncovered part shows.
  const insideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -covered(clock.value) * height }],
  }));
  const frameStyle = useAnimatedStyle(() => {
    const { delay, duration, rise, overshoot, turn } = enter.card;
    const done = through(clock.value, delay, duration);
    const shift =
      done < turn
        ? rise - (rise + overshoot) * cardEase(done / turn)
        : overshoot * (cardEase((done - turn) / (1 - turn)) - 1);
    return {
      opacity: shown.value,
      transform: [{ translateY: shift + covered(clock.value) * height }],
    };
  });
  const bandStyle = useAnimatedStyle(() => {
    const eased = bandEase(through(clock.value, enter.band.delay, enter.band.duration));
    return {
      transform: [{ rotate: card.band.turn }, { translateY: (1 - eased) * enter.band.rise }],
    };
  });
  const titleStyle = useAnimatedStyle(() => {
    const eased = titleEase(through(clock.value, enter.title.delay, enter.title.duration));
    return {
      opacity: Math.min(eased, 1),
      transform: [
        { scale: enter.title.scale + (1 - enter.title.scale) * eased },
        { rotate: `${String((1 - eased) * enter.title.turn)}deg` },
      ],
    };
  });
  const mascotStyle = useAnimatedStyle(() => {
    const eased = mascotEase(through(clock.value, enter.mascot.delay, enter.mascot.duration));
    return {
      opacity: Math.min(eased, 1),
      transform: [
        { translateY: (1 - eased) * enter.mascot.rise },
        { rotate: `${String((1 - eased) * enter.mascot.turn)}deg` },
      ],
    };
  });
  const topStyle = useRise(clock, enter.cascade.top);
  const messageStyle = useRise(clock, enter.cascade.message);
  const captionStyle = useRise(clock, enter.cascade.caption);
  const streakStyle = useRise(clock, enter.cascade.streak);
  const buttonStyle = useRise(clock, enter.cascade.button);
  const plates =
    goal <= PLATES
      ? words.slice(0, goal).map((word) => ({ text: word, word: true }))
      : [
          ...words.slice(0, PLATES - 1).map((word) => ({ text: word, word: true })),
          { text: count(more, goal - (PLATES - 1)), word: false },
        ];
  return (
    <View
      testID="goal-reached"
      style={styles.card}
      onLayout={({ nativeEvent: { layout } }) => {
        setSize({ width: layout.width, height: layout.height });
      }}
    >
      <Animated.View testID="goal-reached-enter" style={[styles.frame, frameStyle]}>
        <Animated.View style={[styles.inside, insideStyle]}>
          {size !== undefined && (
            <HalftoneGround id="goal-reached" width={size.width} height={size.height} />
          )}
          <Animated.View style={[styles.band, { backgroundColor: accentEdge }, bandStyle]} />
          {!still &&
            enter.shards.flights.map((flight, index) => (
              <Shard key={index} index={index} flight={flight} clock={clock} color={cream} />
            ))}
          <Animated.View testID="goal-reached-top" style={[styles.top, topStyle]}>
            <Text style={[typeStyle('goalReachedLabel', tokens), { color: ink }]}>{label}</Text>
            <View style={[styles.plate, { backgroundColor: ink }]}>
              <Text style={[typeStyle('goalReachedPlate', tokens), { color: cream }]}>
                {count(plate, goal)}
              </Text>
            </View>
          </Animated.View>
          <Animated.View testID="goal-reached-title" style={[styles.title, titleStyle]}>
            <Text
              accessibilityRole="header"
              style={[typeStyle('goalReachedTitle', tokens), { color: ink }]}
            >
              {title}
            </Text>
          </Animated.View>
          <Animated.View style={[styles.text, messageStyle]}>
            <Text style={[typeStyle('goalReachedText', tokens), { color: ink }]}>{message}</Text>
          </Animated.View>
          {plates.length > 0 && (
            <View style={styles.words}>
              <Animated.View style={captionStyle}>
                <Text style={[typeStyle('goalReachedCaption', tokens), { color: ink }]}>
                  {collected}
                </Text>
              </Animated.View>
              {plates.map(({ text, word }, index) => {
                const last = index === plates.length - 1;
                return (
                  <WordPlate key={text} index={index} clock={clock} ground={last ? ink : cream}>
                    <Text
                      {...(word ? voice : {})}
                      style={[typeStyle('goalReachedWord', tokens), { color: last ? cream : ink }]}
                    >
                      {text}
                    </Text>
                  </WordPlate>
                );
              })}
            </View>
          )}
          <View style={styles.fill} />
          <View style={styles.foot}>
            <Animated.View testID="goal-reached-mascot" style={mascotStyle}>
              <Mascot state="celebrates" onRed width={card.mascot} />
            </Animated.View>
            {streak !== undefined && (
              <Animated.View testID="goal-reached-streak" style={[styles.streak, streakStyle]}>
                <View style={styles.streakNumber}>
                  <Svg
                    width={card.flame.width}
                    height={card.flame.height}
                    viewBox="0 0 20 26"
                    accessible={false}
                  >
                    <Path
                      d="M10 0c1 5 7 8 7 15a7 7 0 0 1-14 0c0-4 2-6 4-8 0 3 1 4 3 5-1-4 0-8 0-12z"
                      fill={cream}
                    />
                  </Svg>
                  <Text style={[typeStyle('goalReachedStreak', tokens), { color: cream }]}>
                    {streak}
                  </Text>
                </View>
                <Text
                  style={[typeStyle('goalReachedCaption', tokens), styles.right, { color: cream }]}
                >
                  {count(streakLabel, streak)}
                </Text>
              </Animated.View>
            )}
          </View>
          <Animated.View testID="goal-reached-button" style={[styles.buttonPlace, buttonStyle]}>
            <Pressable
              testID="goal-reached-next"
              accessibilityRole="button"
              accessibilityLabel={next}
              onPress={() => turnToNext?.()}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: ink,
                  boxShadow: [
                    {
                      offsetX: 0,
                      offsetY: pressed ? 1 : card.button.shadow,
                      blurRadius: 0,
                      color: card.button.shadowColor,
                    },
                  ],
                  transform: [{ translateY: pressed ? card.button.shadow - 1 : 0 }],
                },
              ]}
            >
              <Text style={[typeStyle('goalReachedButton', tokens), { color: cream }]}>{next}</Text>
              <Svg
                width={card.button.arrow.width}
                height={card.button.arrow.height}
                viewBox="0 0 14 18"
                accessible={false}
              >
                <Polygon points="7,0 14,7 10,7 10,18 4,18 4,7 0,7" fill={cream} />
              </Svg>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/**
 * A Word plate with its cut corners, drawn under its text once its size is
 * known; it slides in from its left, one after the plate before (`fgWord`).
 */
function WordPlate({
  index,
  clock,
  ground,
  children,
}: {
  index: number;
  clock: SharedValue<number>;
  ground: string;
  children: ReactNode;
}) {
  const [size, setSize] = useState<{ width: number; height: number }>();
  const width = size?.width ?? 0;
  const turn = card.word.turns[index] ?? 0;
  const style = useAnimatedStyle(() => {
    const { delay, stagger, duration, behind, turn: startTurn } = enter.words;
    const eased = wordEase(through(clock.value, delay + index * stagger, duration));
    return {
      opacity: Math.min(eased, 1),
      transform: [
        { translateX: (eased - 1) * behind * width },
        { rotate: `${String(startTurn + (turn - startTurn) * eased)}deg` },
      ],
    };
  });
  return (
    <Animated.View
      testID={`goal-reached-word-${String(index)}`}
      onLayout={({ nativeEvent: { layout } }) => {
        setSize({ width: layout.width, height: layout.height });
      }}
      style={[styles.word, { marginLeft: card.word.steps[index] }, style]}
    >
      {size !== undefined && (
        <Svg
          style={StyleSheet.absoluteFill}
          width={size.width}
          height={size.height}
          accessible={false}
        >
          <Polygon
            points={card.word.cut
              .map(([x, y]) => `${String(x * size.width)},${String(y * size.height)}`)
              .join(' ')}
            fill={ground}
          />
        </Svg>
      )}
      {children}
    </Animated.View>
  );
}

/** A shard thrown out from the card's middle, one after the one before, that fades away (`fgShard`). */
function Shard({
  index,
  flight,
  clock,
  color,
}: {
  index: number;
  flight: (typeof enter.shards.flights)[number];
  clock: SharedValue<number>;
  color: string;
}) {
  const { delay, stagger, duration, scale, peak, origin, shape } = enter.shards;
  const style = useAnimatedStyle(() => {
    const done = through(clock.value, delay + index * stagger, duration);
    const eased = shardEase(done);
    return {
      opacity: done < peak ? shardEase(done / peak) : 1 - shardEase((done - peak) / (1 - peak)),
      transform: [
        { translateX: eased * flight.x },
        { translateY: eased * flight.y },
        { rotate: `${String(eased * flight.turn)}deg` },
        { scale: scale + (1 - scale) * eased },
      ],
    };
  });
  return (
    <Animated.View
      testID={`goal-reached-shard-${String(index)}`}
      pointerEvents="none"
      style={[
        styles.shard,
        { left: `${String(origin.x * 100)}%`, top: `${String(origin.y * 100)}%` },
        style,
      ]}
    >
      <Svg width={flight.width} height={flight.height} accessible={false}>
        <Polygon
          points={shape
            .map(([x, y]) => `${String(x * flight.width)},${String(y * flight.height)}`)
            .join(' ')}
          fill={color}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignSelf: 'stretch',
    marginTop: card.margin.top,
    marginBottom: card.margin.bottom,
    marginHorizontal: card.margin.horizontal,
  },
  frame: { flex: 1, borderRadius: card.radius, overflow: 'hidden' },
  inside: {
    flex: 1,
    borderRadius: card.radius,
    overflow: 'hidden',
    paddingTop: card.padding.top,
    paddingHorizontal: card.padding.horizontal,
    paddingBottom: card.padding.bottom,
  },
  band: {
    position: 'absolute',
    left: -card.band.outside,
    right: -card.band.outside,
    bottom: -card.band.below,
    height: card.band.height,
    transformOrigin: 'left top',
  },
  shard: { position: 'absolute' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  plate: {
    paddingVertical: card.plate.padding.vertical,
    paddingHorizontal: card.plate.padding.horizontal,
    transform: [{ skewX: card.plate.skew }],
  },
  title: { marginTop: card.titleGap, transformOrigin: 'left center' },
  text: { marginTop: card.textGap, maxWidth: card.textWidth },
  words: { marginTop: card.wordsGap, alignItems: 'flex-start', gap: card.wordGap },
  word: {
    paddingVertical: card.word.padding.vertical,
    paddingHorizontal: card.word.padding.horizontal,
  },
  fill: { flex: 1 },
  foot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: card.footGap,
  },
  streak: { alignItems: 'flex-end', gap: card.streakGap, marginBottom: card.streakGap },
  streakNumber: { flexDirection: 'row', alignItems: 'center', gap: card.flame.gap },
  right: { textAlign: 'right' },
  buttonPlace: { marginTop: card.buttonGap },
  button: {
    height: card.button.height,
    borderRadius: card.button.radius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: card.button.gap,
  },
});
