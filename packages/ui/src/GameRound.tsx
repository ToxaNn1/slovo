import {
  GAME_LIVES,
  GAME_ROUNDS,
  type RoundAnswer,
  type RoundOption,
  type TextRange,
} from '@slovo/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { BottomSheet } from './BottomSheet';
import { CardCorners } from './DecorSlots';
import { fill, useEdition } from './EditionProvider';
import { HEART_PATH } from './FavoriteButton';
import { useHaptics } from './HapticsProvider';
import { PrimaryButton } from './PrimaryButton';
import { stressLabel } from './stress-label';
import { minTouchTarget, overlineType, space, withAlpha } from './tokens';
import { useSchemeColors, useTokens } from './TokensProvider';
import { useReduceMotion } from './useReduceMotion';
import { WholeWordsText } from './WholeWordsText';

/** A Life's size and the gap between Lives, from the design. */
const LIFE_SIZE = 20;
const LIFE_GAP = 3;
/** The height of the Round's progress bar. */
const BAR_HEIGHT = 4;
/** An answer option's least height, from the design (above the 44 pt touch target). */
const OPTION_HEIGHT = 58;
/** How much an answered Round's other options fade. */
const DIMMED_OPACITY = 0.45;
/** How far the largest text sizes of iOS may scale the smaller text, so it never breaks a word. */
const TEXT_MAX_FONT_SCALE = 1.5;
/** The prompt's, an option's and the sheet's answer's sizes, from the design. */
const PROMPT_SIZE = { fontSize: 25, lineHeight: 25 * 1.35 };
const OPTION_SIZE = { fontSize: 21, lineHeight: 21 * 1.3 };
const SHEET_ANSWER_SIZE = { fontSize: 30, lineHeight: 30 * 1.3 };
/** Whether a label ends in punctuation of its own, such as «?», so VoiceOver needs no full stop after it. */
const ENDS_IN_PUNCTUATION = /\p{P}$/u;
/** The text on a filled option. */
const ON_FILL = '#FFFFFF';

/**
 * The canvas's CSS `ease`, for the Game's motion below, from the design's
 * motion table and canvas keyframes. Each motion runs whatever the system
 * setting, which would otherwise skip the fills and fades too; with Reduce
 * Motion the components leave out the shake, the scale and the pop themselves.
 */
const ease = Easing.bezier(0.25, 0.1, 0.25, 1);
/** The right option fills in 250 ms; with a right answer it also grows to 1.03. */
const RIGHT_FILL = { duration: 250, easing: ease, reduceMotion: ReduceMotion.Never };
const RIGHT_SCALE = 1.03;
/** A wrong choice fills in 200 ms, and the other options fade as quickly. */
const WRONG_FILL = { duration: 200, easing: ease, reduceMotion: ReduceMotion.Never };
/** A wrong choice shakes ±4 pt twice in 400 ms: five steps between the keyframes. */
const SHAKE = [-4, 4, -4, 4, 0] as const;
const SHAKE_STEP = {
  duration: 80,
  easing: Easing.inOut(Easing.ease),
  reduceMotion: ReduceMotion.Never,
};
/**
 * A lost Life pops in 500 ms, up to 1.4 and −12° and back, and its fill fades
 * to the outline on the way back. It comes once the wrong choice has filled,
 * so its haptic follows the wrong answer's instead of blurring into it.
 */
const LIFE_DELAY = WRONG_FILL.duration;
const LIFE_POP = { scale: 1.4, rotate: -12 };
const LIFE_STEP = {
  duration: 250,
  easing: Easing.out(Easing.ease),
  reduceMotion: ReduceMotion.Never,
};
/** The progress bar grows in 400 ms. */
const BAR_GROWTH = { duration: 400, easing: ease, reduceMotion: ReduceMotion.Never };

/**
 * The Round's header (`game-round-dark`): the Rounds passed over a bar that
 * grows as they pass, and the Lives on the right, full in the heart colour,
 * lost as an outline. `leading` sits at its start, where the exit goes.
 */
export function GameHeader({
  roundsPassed,
  lives,
  leading,
}: {
  roundsPassed: number;
  lives: number;
  leading?: ReactNode;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  const words = strings.game.round;
  const progress = { passed: String(roundsPassed), total: String(GAME_ROUNDS) };
  const passed = useSharedValue(roundsPassed);
  useEffect(() => {
    passed.value = withTiming(roundsPassed, BAR_GROWTH);
    // The shared value is stable; only a Round passing grows the bar.
  }, [roundsPassed]);
  // The share of the Rounds passed, as flex weights, so the bar needs no width.
  const filled = useAnimatedStyle(() => ({ flex: passed.value }));
  const unfilled = useAnimatedStyle(() => ({ flex: GAME_ROUNDS - passed.value }));
  return (
    <View style={[styles.header, { paddingLeft: leading === undefined ? space[6] : space[3] }]}>
      {leading}
      <View
        testID="game-progress"
        accessible
        accessibilityLabel={fill(words.progressLabel, progress)}
        {...voice}
        style={styles.progress}
      >
        <Text
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.progressText, { color: colors.ink, fontFamily: fontFamilies.ui }]}
        >
          {fill(words.progress, progress)}
        </Text>
        <View style={[styles.bar, { backgroundColor: colors.track }]}>
          <Animated.View style={[filled, { backgroundColor: colors.accent }]} />
          <Animated.View style={unfilled} />
        </View>
      </View>
      <View
        testID="game-lives"
        accessible
        accessibilityLabel={fill(words.lives, { count: String(lives), total: String(GAME_LIVES) })}
        {...voice}
        style={styles.lives}
      >
        {Array.from({ length: GAME_LIVES }, (_, life) => (
          <Life key={life} full={life < lives} />
        ))}
      </View>
    </View>
  );
}

/**
 * One Life: full in the heart colour, or an outline once lost. A Life lost
 * meanwhile pops to the outline with a medium haptic; with Reduce Motion its
 * fill only fades.
 */
function Life({ full }: { full: boolean }) {
  const { colors } = useTokens();
  const haptics = useHaptics();
  const reduceMotion = useReduceMotion();
  /** 1 while full, 0 once lost. */
  const fullness = useSharedValue(full ? 1 : 0);
  const pop = useSharedValue(0);

  useEffect(() => {
    if (full) {
      fullness.value = 1;
      return;
    }
    if (fullness.value === 0) return;
    // The fill fades as the pop comes back, or at once with Reduce Motion.
    fullness.value = withDelay(
      reduceMotion ? LIFE_DELAY : LIFE_DELAY + LIFE_STEP.duration,
      withTiming(0, LIFE_STEP),
    );
    if (!reduceMotion) {
      pop.value = withDelay(
        LIFE_DELAY,
        withSequence(withTiming(1, LIFE_STEP), withTiming(0, LIFE_STEP)),
      );
    }
    const timer = setTimeout(() => {
      haptics.impactMedium();
    }, LIFE_DELAY);
    return () => {
      clearTimeout(timer);
    };
    // The shared values are stable; only losing the Life pops it.
  }, [full]);

  const popStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + (LIFE_POP.scale - 1) * pop.value },
      { rotate: `${String(LIFE_POP.rotate * pop.value)}deg` },
    ],
  }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fullness.value }));

  const heart = (paint: string, stroke: string) => (
    <Svg width={LIFE_SIZE} height={LIFE_SIZE} viewBox="0 0 24 24">
      <Path d={HEART_PATH} fill={paint} stroke={stroke} strokeWidth={1.8} />
    </Svg>
  );
  return (
    <Animated.View style={popStyle}>
      {heart('none', withAlpha(colors.ink, 0.32))}
      <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
        {heart(colors.heart, colors.heart)}
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The Round's prompt (`game-round-dark`, `game-round-correction-answered-light`):
 * its label over the prompt on a surface card with the Edition's corners, the
 * highlight, such as a non-standard form, on the sunken fill and underlined in
 * the accent. VoiceOver reads it before the options, then names the highlight.
 */
export function RoundCard({
  label,
  prompt,
  highlight,
}: {
  label: string;
  prompt: string;
  /** The part of the prompt to mark; nothing to mark. */
  highlight: TextRange | undefined;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const { strings, voice } = useEdition();
  const marked =
    highlight === undefined
      ? undefined
      : fill(strings.game.round.highlight, {
          text: prompt.slice(highlight.start, highlight.end),
        });
  return (
    <View
      testID="game-prompt"
      accessible
      accessibilityLabel={[
        `${label}${ENDS_IN_PUNCTUATION.test(label) ? '' : '.'} ${prompt}`,
        marked,
      ]
        .filter(Boolean)
        .join(' ')}
      {...voice}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.card },
      ]}
    >
      <CardCorners corners={['topLeft', 'bottomRight']} />
      <Text
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        style={[overlineType, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {label}
      </Text>
      <WholeWordsText
        text={prompt}
        size={PROMPT_SIZE}
        tracking={0}
        style={{ color: colors.ink, fontFamily: fontFamilies.word }}
        highlight={
          highlight === undefined
            ? undefined
            : {
                range: highlight,
                style: {
                  backgroundColor: colors.surfaceSunken,
                  textDecorationLine: 'underline',
                  textDecorationColor: colors.accent,
                },
              }
        }
      />
    </View>
  );
}

/**
 * One option of a Round, 58 pt tall. Once the Round is answered, the right
 * option fills in the correct colour with «Правильно», a wrong choice in the
 * wrong colour with «Ваш вибір», and the others fade; the fills are the light
 * scheme's in both Themes, under white text. The chosen option plays the
 * answer's haptic, success or warning; a right one grows a little and a wrong
 * one shakes, both left out with Reduce Motion. VoiceOver reads the option
 * with its Stress, then its tag, and the faded ones as dimmed.
 */
export function AnswerOption({
  option,
  place,
  answer,
  onPress,
}: {
  option: RoundOption;
  /** Its place among the options. */
  place: number;
  /** The Round's answer, once given. */
  answer: RoundAnswer | undefined;
  onPress: () => void;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const light = useSchemeColors('light');
  const { strings, voice } = useEdition();
  const tag =
    answer === undefined
      ? undefined
      : place === answer.correct
        ? { text: strings.game.round.correct, fill: light.correct }
        : place === answer.chosen
          ? { text: strings.game.round.chosen, fill: light.wrong }
          : undefined;
  const dimmed = answer !== undefined && tag === undefined;
  const right = place === answer?.correct;
  const chosen = place === answer?.chosen;
  const haptics = useHaptics();
  const reduceMotion = useReduceMotion();
  /** 0 before the answer, 1 once the option has filled or faded. */
  const answered = useSharedValue(answer === undefined ? 0 : 1);
  /** 0 at rest, 1 grown: a right answer's option. */
  const grown = useSharedValue(0);
  const shift = useSharedValue(0);
  // Whether the option showed an answer before, so only the answer given now moves and plays.
  const shownAnswered = useRef(answer !== undefined);

  useEffect(() => {
    if (answer === undefined || shownAnswered.current) return;
    shownAnswered.current = true;
    answered.value = withTiming(1, right ? RIGHT_FILL : WRONG_FILL);
    if (!chosen) return;
    if (right) haptics.success();
    else haptics.warning();
    if (reduceMotion) return;
    if (right) grown.value = withTiming(1, RIGHT_FILL);
    else shift.value = withSequence(...SHAKE.map((offset) => withTiming(offset, SHAKE_STEP)));
    // The shared values are stable; only the answer moves the option.
  }, [answer]);

  const motion = useAnimatedStyle(() => ({
    opacity: dimmed ? 1 - (1 - DIMMED_OPACITY) * answered.value : 1,
    transform: [{ translateX: shift.value }, { scale: 1 + (RIGHT_SCALE - 1) * grown.value }],
  }));
  const fillStyle = useAnimatedStyle(() =>
    tag === undefined
      ? {}
      : {
          backgroundColor: interpolateColor(answered.value, [0, 1], [colors.surface, tag.fill]),
          borderColor: interpolateColor(answered.value, [0, 1], [colors.line, tag.fill]),
        },
  );
  return (
    <Pressable
      testID={`game-option-${String(place)}`}
      accessibilityRole="button"
      accessibilityLabel={[
        stressLabel(strings.wordCard, option.text, option.stressedVowels),
        tag?.text,
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityState={{ disabled: dimmed }}
      {...voice}
      disabled={answer !== undefined}
      onPress={onPress}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.option,
            {
              backgroundColor: pressed ? colors.surfaceSunken : colors.surface,
              borderColor: colors.line,
              borderRadius: radii.button,
            },
            fillStyle,
            motion,
          ]}
        >
          <View style={styles.optionText}>
            <WholeWordsText
              text={option.text}
              size={OPTION_SIZE}
              tracking={0}
              style={[
                styles.optionWord,
                { color: tag === undefined ? colors.ink : ON_FILL, fontFamily: fontFamilies.word },
              ]}
            />
          </View>
          {tag === undefined ? null : (
            <Text
              maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
              style={[styles.tag, { color: ON_FILL, fontFamily: fontFamilies.ui }]}
            >
              {tag.text}
            </Text>
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

/**
 * The sheet after an answer (`game-round-correct-dark`,
 * `game-round-wrong-dark`, `game-round-correction-answered-light`):
 * «Правильно!» or «Не цього разу», the right answer with its Stress and its
 * Example with the author, or its explanation, or the answer alone, and
 * «Далі», the only way to close it. It is drawn in the other colour scheme
 * and keeps what it showed while it slides away.
 */
export function AnswerSheet({
  answer,
  onNext,
}: {
  answer: RoundAnswer | undefined;
  onNext: () => void;
}) {
  // The answer it shows, kept while the sheet leaves after «Далі» took the Round's away.
  const [shown, setShown] = useState(answer);
  if (answer !== undefined && answer !== shown) setShown(answer);
  return (
    <BottomSheet visible={answer !== undefined} inverted testID="game-sheet">
      {shown === undefined ? null : <AnswerSheetContent answer={shown} onNext={onNext} />}
    </BottomSheet>
  );
}

function AnswerSheetContent({ answer, onNext }: { answer: RoundAnswer; onNext: () => void }) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  const right = answer.chosen === answer.correct;
  const { example, explanation } = answer.sheet;
  return (
    <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
      <Text
        testID="game-sheet-title"
        accessibilityRole="header"
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        {...voice}
        style={[
          styles.sheetTitle,
          { color: right ? colors.correct : colors.wrong, fontFamily: fontFamilies.ui },
        ]}
      >
        {right ? strings.game.sheet.correct : strings.game.sheet.wrong}
      </Text>
      <WholeWordsText
        text={answer.sheet.answer.text}
        size={SHEET_ANSWER_SIZE}
        tracking={0}
        accessibilityLabel={stressLabel(
          strings.wordCard,
          answer.sheet.answer.text,
          answer.sheet.answer.stressedVowels,
        )}
        {...voice}
        style={[styles.sheetAnswer, { color: colors.ink, fontFamily: fontFamilies.word }]}
      />
      {example === undefined ? null : (
        <View accessible {...voice}>
          <Text
            maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
            style={[styles.example, { color: colors.inkSecondary, fontFamily: fontFamilies.word }]}
          >
            {fill(strings.wordCard.example, { text: example.text })}
          </Text>
          {example.author === undefined ? null : (
            <Text
              maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
              style={[styles.author, { color: colors.muted, fontFamily: fontFamilies.ui }]}
            >
              {fill(strings.wordCard.exampleAuthor, { author: example.author })}
            </Text>
          )}
        </View>
      )}
      {explanation === undefined ? null : (
        <Text
          testID="game-sheet-explanation"
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          {...voice}
          style={[styles.explanation, { color: colors.ink, fontFamily: fontFamilies.ui }]}
        >
          {explanation}
        </Text>
      )}
      <View style={styles.next}>
        <PrimaryButton testID="game-next" label={strings.game.sheet.next} onPress={onNext} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: minTouchTarget,
    paddingRight: space[4],
  },
  progress: { flex: 1, gap: 6 },
  progressText: { fontSize: 13, fontWeight: '700' },
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  lives: { flexDirection: 'row', gap: LIFE_GAP },
  card: {
    minHeight: 220,
    justifyContent: 'center',
    gap: space[4],
    paddingVertical: 30,
    paddingHorizontal: space[6],
    borderWidth: 1,
  },
  option: {
    minHeight: OPTION_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingHorizontal: space[5],
    paddingVertical: space[2],
    borderWidth: 1,
  },
  optionText: { flex: 1 },
  optionWord: { fontWeight: '500' },
  tag: { fontSize: 13, fontWeight: '700' },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  sheetContent: { gap: 14, paddingHorizontal: space[1], paddingBottom: space[2] },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  sheetAnswer: { fontWeight: '500' },
  example: { fontSize: 17, lineHeight: 17 * 1.5, fontStyle: 'italic' },
  author: { marginTop: space[1], fontSize: 13, fontWeight: '500' },
  explanation: { fontSize: 16, lineHeight: 16 * 1.55 },
  next: { marginTop: 6 },
});
