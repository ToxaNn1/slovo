'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { motion, quizOption, typeStyle } from '../tokens';
import { PressedTile } from './PressedTile';
import { bezier } from './timing';

const { pop, wrong } = quizOption;
const popEasing = bezier(motion.pop.easing);
const still = { reduceMotion: ReduceMotion.Never } as const;

/** How an option looks: before a pick, the right one lit red, the wrong one picked, or another faded. */
export type QuizOptionLook = 'rest' | 'right' | 'wrong' | 'dimmed';

/**
 * One meaning of a quiz of three meanings on its tile, as `look` says, for
 * Yesterday (board f5) and the Due Quiz (board 09): the right one lit red
 * with a check, the wrong pick ink, struck through with a cross and sunk, the
 * rest faded; before that, its `mark` («А») on the right, when it has one. A
 * look it turns to plays its motion once: the right one pops, the wrong one
 * shakes; under Reduce Motion neither.
 */
export function QuizOption({
  meaning,
  look,
  picked,
  mark,
  minHeight = quizOption.height,
  accessibilityLabel,
  onPress,
  testID,
}: {
  meaning: string;
  look: QuizOptionLook;
  /** Whether the reader picked it: VoiceOver reads only the pick as selected. */
  picked: boolean;
  /** What stands on its right before a pick or once faded, such as «А». */
  mark?: string | undefined;
  minHeight?: number;
  /** What VoiceOver reads, in the Edition's language. */
  accessibilityLabel: string;
  onPress: () => void;
  /** Its own id; the parts take `-place`, `-motion`, `-check` and `-cross` after it. */
  testID: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const keyInk = useSchemeColors('light').ink;
  const { voice } = useEdition();
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const shake = useSharedValue(0);
  const shown = useRef(look);
  useEffect(() => {
    if (shown.current === look) return;
    shown.current = look;
    if (reduceMotion) return;
    if (look === 'right')
      scale.value = withSequence(
        withTiming(pop.from, { duration: 0, ...still }),
        withTiming(pop.peak, { duration: pop.duration * pop.peakAt, easing: popEasing, ...still }),
        withTiming(1, { duration: pop.duration * (1 - pop.peakAt), easing: popEasing, ...still }),
      );
    if (look === 'wrong')
      shake.value = withSequence(
        ...wrong.shake.map((to) =>
          withTiming(to, { duration: wrong.duration / wrong.shake.length, ...still }),
        ),
      );
  }, [look, reduceMotion, scale, shake]);
  const optionMotion = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }, { scale: scale.value }],
  }));
  const ink = look === 'right' ? keyInk : look === 'wrong' ? colors.background : colors.ink;
  return (
    <View
      testID={`${testID}-place`}
      style={[look === 'dimmed' && styles.dimmed, look === 'wrong' && styles.sunk]}
    >
      <Animated.View testID={`${testID}-motion`} style={optionMotion}>
        <PressedTile
          testID={testID}
          tone={look === 'right' ? 'accent' : look === 'wrong' ? 'none' : 'tile'}
          radius={quizOption.radius}
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ selected: picked }}
          onPress={onPress}
          faceStyle={[
            styles.option,
            {
              minHeight,
              borderColor: look === 'rest' || look === 'dimmed' ? colors.line : 'transparent',
            },
            look === 'wrong' && { backgroundColor: colors.ink },
          ]}
        >
          <Text
            {...voice}
            style={[
              typeStyle('yesterdayOption', tokens),
              styles.meaning,
              { color: ink },
              look === 'wrong' && styles.struck,
            ]}
          >
            {meaning}
          </Text>
          {look === 'right' && (
            <Svg
              testID={`${testID}-check`}
              width={quizOption.check.width}
              height={quizOption.check.height}
              viewBox="0 0 26 22"
            >
              <Polygon points="0,12 4,8 10,14 22,0 26,4 10,22" fill={ink} />
            </Svg>
          )}
          {look === 'wrong' && (
            <Svg
              testID={`${testID}-cross`}
              width={quizOption.cross}
              height={quizOption.cross}
              viewBox="0 0 20 20"
            >
              <Polygon
                points="3,0 10,7 17,0 20,3 13,10 20,17 17,20 10,13 3,20 0,17 7,10 0,3"
                fill={ink}
              />
            </Svg>
          )}
          {(look === 'rest' || look === 'dimmed') && mark !== undefined && (
            <Text
              {...voice}
              importantForAccessibility="no"
              style={[typeStyle('dueQuizMark', tokens), { color: ink }]}
            >
              {mark}
            </Text>
          )}
        </PressedTile>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: quizOption.gap,
    paddingHorizontal: quizOption.padding,
    borderWidth: quizOption.border,
  },
  meaning: { flexShrink: 1 },
  struck: { textDecorationLine: 'line-through' },
  dimmed: { opacity: quizOption.dimmedOpacity },
  sunk: { transform: [{ translateY: wrong.sink }] },
});
