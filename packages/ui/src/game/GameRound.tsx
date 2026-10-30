'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import type { EditionStrings } from '@slovo/contracts';
import {
  stressLabel,
  type CurrentGame,
  type GivenAnswer,
  type Round,
  type RoundAnswer,
  type RoundBlank,
  type RoundOption,
  type TextRange,
} from '@slovo/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

import { BottomSheet } from '../primitives/BottomSheet';
import { ConfirmationDialog } from '../primitives/ConfirmationDialog';
import { CardCorners } from '../decor/DecorSlots';
import { fill, useEdition } from '../providers/EditionProvider';
import { HEART_PATH } from '../saved/FavoriteButton';
import { PrimaryButton } from '../primitives/PrimaryButton';
import {
  minTouchTarget,
  onFill,
  overlineType,
  roundLayout,
  space,
  typeSize,
  withAlpha,
} from '../tokens';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { ease, RIGHT_FILL, shake, WRONG_FILL } from './round-motion';
import { OrderedChips } from './OrderedChips';
import { GameTimer } from './GameTimer';
import { PairsGrid } from './PairsGrid';
import { TypedAnswer } from './TypedAnswer';
import { useGameHaptics } from './useGameHaptics';
import { VowelButtons } from './VowelButtons';
import { useReduceMotion } from '../providers/useReduceMotion';
import { WholeWordsText } from '../primitives/WholeWordsText';

/** A Life's size and the gap between Lives, from the design. */
const LIFE_SIZE = 20;
const LIFE_GAP = 3;
/** The ✕'s glyph size; its touch target is `minTouchTarget`. */
const EXIT_SIZE = 20;
/** The height of the Round's progress bar. */
const BAR_HEIGHT = 4;
/** An answer option's least height, from the design (above the 44 pt touch target). */
const OPTION_HEIGHT = 58;
/** How much an answered Round's other options fade. */
const DIMMED_OPACITY = 0.45;
/** How far the largest text sizes of iOS may scale the smaller text, so it never breaks a word. */
const TEXT_MAX_FONT_SCALE = 1.5;
/** The prompt's, an option's and the sheet's answer's sizes, from the design. */
const PROMPT_SIZE = { fontSize: typeSize.roundPrompt, lineHeight: typeSize.roundPrompt * 1.35 };
const OPTION_SIZE = { fontSize: typeSize.roundOption, lineHeight: typeSize.roundOption * 1.3 };
const SHEET_ANSWER_SIZE = {
  fontSize: typeSize.roundAnswer,
  lineHeight: typeSize.roundAnswer * 1.3,
};
/** Whether a label ends in punctuation of its own, such as «?», so VoiceOver needs no full stop after it. */
const ENDS_IN_PUNCTUATION = /\p{P}$/u;

/** A right answer's option grows to 1.03 as it fills. */
const RIGHT_SCALE = 1.03;
/**
 * A lost Life pops in 300 ms, up to 1.4 and −12° and back, and its fill fades
 * to the outline on the way back. It comes once the wrong choice has filled,
 * when the Round says the Life is lost, as its haptic does.
 */
const LIFE_POP = { scale: 1.4, rotate: -12 };
const LIFE_STEP = {
  duration: 150,
  easing: Easing.out(Easing.ease),
  reduceMotion: ReduceMotion.Never,
};
/** With Reduce Motion a lost Life's fill only fades, in 250 ms. */
const LIFE_FADE = { ...LIFE_STEP, duration: 250 };
/** The progress bar grows in 300 ms; with Reduce Motion it is set at once, as its edge moves across the header. */
const BAR_GROWTH = { duration: 300, easing: ease, reduceMotion: ReduceMotion.Never };

/** The answer to a Round of the pick form. */
type PickAnswer = Extract<RoundAnswer, { form: 'pick' }>;

/**
 * A Round of the Game in play (`game-round-dark`): the header with the ✕, the
 * prompt under its label, the four options and, once answered, the sheet.
 * It plays the pick form, the vowel form, whose Word stands in the card
 * with each vowel a button, and the pairs form, whose grid stands under the
 * mode's label in place of the card and the options, the chips form, whose
 * chips, a Word's letters or an expression's words, stand under the card in
 * place of the options, and the typed form,
 * whose field stands under the card in place of the options, with the
 * Word's blanks and «Відкрити літеру» in a Round that shows blanks. A
 * Synonym Row's Round asks «Що є синонімом до „{dominant}“?» and a Tip's its
 * own question, each under its kind's label rather than the mode's.
 * The ✕ asks first, with the SLOVO confirmation dialog, as «Очистити Історію?»
 * does; «Грати далі» leaves the Round as it was.
 */
export function GameRound({
  game,
  label,
  onAnswer,
  onNext,
  onLeave,
  onOpenLetter,
  timeLeft,
}: {
  game: CurrentGame;
  /** The label over the prompt, the Game Mode's, for a Round about a Word, an idiom or a Correction. */
  label: string;
  onAnswer: (given: GivenAnswer) => void;
  onNext: () => void;
  /** Leaves the Game, once the reader has confirmed it. */
  onLeave: () => void;
  /** «Відкрити літеру» in a typed Round with blanks. */
  onOpenLetter: () => void;
  /** The play time left now in a timed Game, as the screen ticks it; the Game's own when none. */
  timeLeft?: number | undefined;
}) {
  const { strings } = useEdition();
  const { round } = game;
  const { answer } = round;
  const gameHaptics = useGameHaptics();
  // The answer just given: the Round's, or in a timed Game, which moves on at once, the last Round's.
  const given = game.time === undefined ? answer : game.played.at(-1)?.answer;
  // The answer shown before, so only the answer given now plays.
  const shownAnswer = useRef(given);

  useEffect(() => {
    if (given === shownAnswer.current) return;
    shownAnswer.current = given;
    if (given === undefined) return;
    if (given.right) gameHaptics.rightAnswer();
    else gameHaptics.wrongAnswer();
    // New haptics, after a change of Vibration, find the answer already played.
  }, [given, gameHaptics]);

  const [asking, setAsking] = useState(false);
  const exit = strings.game.exit;
  const asked = askedAs(round, label, strings.game.round);
  const options = round.form === 'pick' ? round.options : [];
  const pickAnswer = answer?.form === 'pick' ? answer : undefined;

  return (
    <View testID="game-round" style={styles.screen}>
      <GameHeader
        roundsPassed={game.roundsPassed}
        roundLimit={game.roundLimit}
        lives={game.lives}
        livesAtStart={game.livesAtStart}
        lifeLostAfter={round.lifeLostAfter}
        time={
          game.time === undefined || game.timeLimit === undefined
            ? undefined
            : { left: timeLeft ?? game.time.left, limit: game.timeLimit }
        }
        onExit={() => {
          setAsking(true);
        }}
      />
      <ScrollView contentContainerStyle={styles.round}>
        {round.form === 'vowel' ? (
          <RoundCard
            label={asked.label}
            prompt={asked.prompt}
            highlight={undefined}
            gap={undefined}
          >
            <VowelButtons
              key={round.number}
              text={round.prompt}
              vowels={round.vowels}
              answer={answer?.form === 'vowel' ? answer : undefined}
              onAnswer={(position) => {
                onAnswer({ form: 'vowel', position });
              }}
              texts={{
                vowelLabel: (letter, place) => letterLabel(strings.game.letters, letter, place),
                correct: strings.game.round.correct,
                chosen: strings.game.round.chosen,
              }}
              testID="game-vowels"
            />
          </RoundCard>
        ) : round.form === 'pairs' ? (
          <>
            <RoundLabel label={asked.label} />
            <PairsGrid
              key={round.number}
              words={round.words}
              definitions={round.definitions}
              answer={answer?.form === 'pairs' ? answer : undefined}
              onAnswer={(word, definition) => {
                onAnswer({ form: 'pairs', word, definition });
              }}
            />
          </>
        ) : (
          <RoundCard
            label={asked.label}
            prompt={asked.prompt}
            highlight={round.highlight}
            gap={round.gap}
            definition={round.definition}
          />
        )}
        {round.form === 'chips' && (
          <OrderedChips
            key={round.number}
            chips={round.chips}
            kind={round.entryKind === 'idiom' ? 'word' : 'letter'}
            fixed={round.fixed}
            answer={answer?.form === 'chips' ? answer : undefined}
            onAnswer={(chips) => {
              onAnswer({ form: 'chips', chips });
            }}
          />
        )}
        {round.form === 'typed' && (
          <TypedRoundAnswer
            key={round.number}
            blanks={round.blanks}
            onAnswer={(text) => {
              onAnswer({ form: 'typed', text });
            }}
            onOpenLetter={onOpenLetter}
          />
        )}
        <View style={styles.options}>
          {options.map((option, place) => (
            <AnswerOption
              key={`${String(round.number)}-${String(place)}`}
              option={option}
              place={place}
              answer={pickAnswer}
              onPress={() => {
                onAnswer({ form: 'pick', option: place });
              }}
            />
          ))}
        </View>
      </ScrollView>
      <AnswerSheet answer={round.answer} onNext={onNext} />
      <ConfirmationDialog
        visible={asking}
        title={exit.title}
        message={exit.message}
        destructiveLabel={exit.confirm}
        cancelLabel={exit.cancel}
        onDestructive={() => {
          setAsking(false);
          onLeave();
        }}
        onCancel={() => {
          setAsking(false);
        }}
        testID="game-exit-dialog"
      />
    </View>
  );
}

/**
 * The label and the prompt a Round shows by the kind of Entry it asks about:
 * a Synonym Row's question on its dominant, a Tip's own question under the
 * Tip's label, an Example with a gap under the gap's label, any other Round's
 * prompt under the mode's label.
 */
function askedAs(
  { entryKind, prompt, gap }: Round,
  label: string,
  strings: EditionStrings['game']['round'],
): { label: string; prompt: string } {
  if (entryKind === 'synonymRow') {
    const { synonymRow } = strings;
    return { label: synonymRow.label, prompt: fill(synonymRow.prompt, { dominant: prompt }) };
  }
  if (entryKind === 'tip') return { label: strings.tip.label, prompt };
  if (gap !== undefined) return { label: strings.gap.label, prompt };
  return { label, prompt };
}

/**
 * What VoiceOver reads for a letter at its place among a Word's letters from
 * 0, «а, третя літера»; past the Edition's ordinals, the place's number.
 */
function letterLabel(
  texts: EditionStrings['game']['letters'],
  letter: string,
  place: number,
): string {
  return fill(texts.label, { letter, place: texts.ordinals[place] ?? String(place + 1) });
}

/**
 * A typed Round's answer under its card: the Word's blanks, if the Round
 * shows them, with «Відкрити літеру», and the field, which keeps what the
 * reader typed until the Round is answered. VoiceOver reads each blank by its
 * place among the letters. The keyboard goes as the answer is given, so the
 * sheet shows whole.
 */
function TypedRoundAnswer({
  blanks,
  onAnswer,
  onOpenLetter,
}: {
  /** The Word's blanks, as the Core opens them; none in a Round that shows none. */
  blanks: readonly RoundBlank[] | undefined;
  onAnswer: (text: string) => void;
  onOpenLetter: () => void;
}) {
  const { strings } = useEdition();
  const { letters, openLetter, round } = strings.game;
  const [text, setText] = useState('');
  return (
    <TypedAnswer
      value={text}
      onChangeText={setText}
      onSubmit={() => {
        Keyboard.dismiss();
        onAnswer(text);
      }}
      blanks={blanks}
      onOpenLetter={blanks === undefined ? undefined : onOpenLetter}
      texts={{
        label: round.typed.label,
        submit: round.typed.submit,
        openLetter,
        blankLabel: (place, letter) =>
          letter === undefined
            ? fill(letters.empty, { place: letters.ordinals[place] ?? String(place + 1) })
            : letterLabel(letters, letter, place),
      }}
      testID="game-typed"
    />
  );
}

/**
 * The Round's header (`game-round-dark`): the ✕ at its start, the Rounds
 * passed over a bar that grows as they pass towards the mode's Round limit,
 * or with no limit just the Rounds passed, or in a timed Game the timer in
 * their place, and the Lives on the right, full in the heart colour, lost as
 * an outline.
 */
function GameHeader({
  roundsPassed,
  roundLimit,
  lives,
  livesAtStart,
  lifeLostAfter,
  time,
  onExit,
}: {
  roundsPassed: number;
  /** The mode's Round limit; none in a mode without one, which shows no bar. */
  roundLimit: number | undefined;
  /** The Lives left; none in a mode without Lives, which shows none. */
  lives: number | undefined;
  /** The Lives the Game started with. */
  livesAtStart: number | undefined;
  /** How long after a wrong answer its Life is lost, in milliseconds. */
  lifeLostAfter: number;
  /** The play time left of a timed Game and its whole time, in milliseconds; none in another Game. */
  time: { left: number; limit: number } | undefined;
  onExit: () => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice, count } = useEdition();
  const words = strings.game.round;
  const progress = { passed: String(roundsPassed), total: String(roundLimit ?? '') };
  const reduceMotion = useReduceMotion();
  const passed = useSharedValue(roundsPassed);
  useEffect(() => {
    passed.value = reduceMotion ? roundsPassed : withTiming(roundsPassed, BAR_GROWTH);
    // The shared value is stable, so only a Round passing grows the bar.
  }, [roundsPassed, reduceMotion, passed]);
  // The share of the Rounds passed, as flex weights, so the bar needs no width.
  const filled = useAnimatedStyle(() => ({ flex: passed.value }));
  const unfilled = useAnimatedStyle(() => ({ flex: (roundLimit ?? 0) - passed.value }));
  return (
    <View style={styles.header}>
      <ExitButton onPress={onExit} />
      {time === undefined ? (
        <View
          testID="game-progress"
          accessible
          accessibilityLabel={fill(
            roundLimit === undefined ? words.passedLabel : words.progressLabel,
            progress,
          )}
          {...voice}
          style={styles.progress}
        >
          <Text
            maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
            style={[styles.progressText, { color: colors.ink, fontFamily: fontFamilies.ui }]}
          >
            {fill(roundLimit === undefined ? words.passed : words.progress, progress)}
          </Text>
          {roundLimit === undefined ? null : (
            <View
              testID="game-progress-bar"
              style={[styles.bar, { backgroundColor: colors.track }]}
            >
              <Animated.View
                testID="game-progress-filled"
                style={[filled, { backgroundColor: colors.accent }]}
              />
              <Animated.View style={unfilled} />
            </View>
          )}
        </View>
      ) : (
        <GameTimer
          remainingMs={time.left}
          totalMs={time.limit}
          texts={{ remaining: (seconds) => count(words.timer, seconds) }}
          testID="game-timer"
        />
      )}
      {lives !== undefined && livesAtStart !== undefined && (
        <View
          testID="game-lives"
          accessible
          accessibilityLabel={fill(words.lives, {
            count: String(lives),
            total: String(livesAtStart),
          })}
          {...voice}
          style={styles.lives}
        >
          {Array.from({ length: livesAtStart }, (_, life) => (
            <Life key={life} place={life} full={life < lives} lostAfter={lifeLostAfter} />
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * The ✕ at the start of the Round's header (`game-round-dark`), 44 pt, which
 * VoiceOver reads as the Edition's «Вийти з гри».
 */
function ExitButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTokens();
  const { strings, voice } = useEdition();
  return (
    <Pressable
      testID="game-exit"
      accessibilityRole="button"
      accessibilityLabel={strings.game.exit.label}
      {...voice}
      onPress={onPress}
      style={styles.exit}
    >
      <Svg width={EXIT_SIZE} height={EXIT_SIZE} viewBox="0 0 24 24">
        <Path
          d="M5 5l14 14M19 5L5 19"
          fill="none"
          stroke={colors.ink}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    </Pressable>
  );
}

/**
 * One Life: full in the heart colour, or an outline once lost. A Life lost
 * meanwhile pops to the outline; with Reduce Motion its fill only fades. Its
 * haptic comes with the wrong answer that cost it.
 */
function Life({
  place,
  full,
  lostAfter,
}: {
  place: number;
  full: boolean;
  /** How long after the wrong answer the Life is lost, in milliseconds: when it pops. */
  lostAfter: number;
}) {
  const { colors } = useTokens();
  const reduceMotion = useReduceMotion();
  /** 1 while full, 0 once lost. */
  const fullness = useSharedValue(full ? 1 : 0);
  const pop = useSharedValue(0);
  // Whether the Life showed full before, so only losing it now pops it.
  const shownFull = useRef(full);

  useEffect(() => {
    if (full) {
      shownFull.current = true;
      fullness.value = 1;
      return;
    }
    if (!shownFull.current) return;
    shownFull.current = false;
    // The fill fades as the pop comes back, or at once with Reduce Motion.
    fullness.value = withDelay(
      reduceMotion ? lostAfter : lostAfter + LIFE_STEP.duration,
      withTiming(0, reduceMotion ? LIFE_FADE : LIFE_STEP),
    );
    if (!reduceMotion) {
      pop.value = withDelay(
        lostAfter,
        withSequence(withTiming(1, LIFE_STEP), withTiming(0, LIFE_STEP)),
      );
    }
    // The shared values are stable, and a change of Reduce Motion finds the
    // Life already lost.
  }, [full, reduceMotion, lostAfter, fullness, pop]);

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
    <Animated.View testID={`game-life-${String(place)}`} style={popStyle}>
      {heart('none', withAlpha(colors.ink, 0.32))}
      <Animated.View
        testID={`game-life-${String(place)}-fill`}
        style={[StyleSheet.absoluteFill, fillStyle]}
      >
        {heart(colors.heart, colors.heart)}
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The Round's prompt (`game-round-dark`, `game-round-correction-answered-light`):
 * its label over the prompt on a surface card with the Edition's corners, the
 * highlight, such as a non-standard form, on the sunken fill and underlined in
 * the accent. VoiceOver reads it before the options, then names the highlight;
 * a gap it reads in its place, as the Edition calls it.
 * A Definition, such as a Word's in «Звідки слово», stands under the prompt,
 * and VoiceOver reads it after the prompt.
 * An answer drawn in the prompt's place, such as the vowel buttons, stands in
 * for the prompt, and VoiceOver reads the label, then each of its buttons.
 */
function RoundCard({
  label,
  prompt,
  highlight,
  gap,
  definition,
  children,
}: {
  label: string;
  prompt: string;
  /** The part of the prompt to mark; nothing to mark. */
  highlight: TextRange | undefined;
  /** The gap in the prompt, which VoiceOver reads as one and which is no highlight to name; none. */
  gap: TextRange | undefined;
  /** The Definition under the prompt; none to show. */
  definition?: string | undefined;
  /** What the card shows for the prompt, the answer drawn in it; the prompt's text if nothing. */
  children?: ReactNode;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const { strings, voice } = useEdition();
  const read =
    gap === undefined
      ? prompt
      : `${prompt.slice(0, gap.start)}${strings.game.round.gap.voiceOver}${prompt.slice(gap.end)}`;
  const marked =
    highlight === undefined || gap !== undefined
      ? undefined
      : fill(strings.game.round.highlight, {
          text: prompt.slice(highlight.start, highlight.end),
        });
  const defined =
    definition === undefined ? '' : `${ENDS_IN_PUNCTUATION.test(read) ? '' : '.'} ${definition}`;
  return (
    <View
      testID="game-prompt"
      accessible={children === undefined}
      accessibilityLabel={
        children === undefined
          ? [`${label}${ENDS_IN_PUNCTUATION.test(label) ? '' : '.'} ${read}${defined}`, marked]
              .filter(Boolean)
              .join(' ')
          : undefined
      }
      {...voice}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.line, borderRadius: radii.card },
      ]}
    >
      <CardCorners corners={['topLeft', 'bottomRight']} />
      <Text
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        {...voice}
        style={[overlineType, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {label}
      </Text>
      {children ?? (
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
      )}
      {definition !== undefined && (
        <Text
          testID="game-definition"
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          {...voice}
          style={[styles.explanation, { color: colors.ink, fontFamily: fontFamilies.ui }]}
        >
          {definition}
        </Text>
      )}
    </View>
  );
}

/**
 * The mode's label over a Round without a prompt, such as a pairs grid, which
 * VoiceOver reads as the Round's heading before the grid.
 */
function RoundLabel({ label }: { label: string }) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <Text
      testID="game-prompt"
      accessibilityRole="header"
      maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
      {...voice}
      style={[overlineType, styles.label, { color: colors.muted, fontFamily: fontFamilies.ui }]}
    >
      {label}
    </Text>
  );
}

/**
 * One option of a Round, 58 pt tall. Once the Round is answered, the right
 * option fills in the correct colour with «Правильно», a wrong choice in the
 * wrong colour with «Ваш вибір», and the others fade; the fills are the light
 * scheme's in both Themes, under white text. The chosen option, if right,
 * grows a little and, if wrong, shakes, both left out with Reduce Motion.
 * VoiceOver reads the option with its Stress, then its tag, and the faded ones
 * as dimmed.
 */
function AnswerOption({
  option,
  place,
  answer,
  onPress,
}: {
  option: RoundOption;
  /** Its place among the options. */
  place: number;
  /** The Round's answer, once given. */
  answer: PickAnswer | undefined;
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
  const reduceMotion = useReduceMotion();
  /** 0 before the answer, 1 once the option has filled or faded. */
  const answered = useSharedValue(answer === undefined ? 0 : 1);
  /** 0 at rest, 1 grown: a right answer's option. */
  const grown = useSharedValue(0);
  const shift = useSharedValue(0);
  // Whether the option showed an answer before, so only the answer given now moves.
  const shownAnswered = useRef(answer !== undefined);

  useEffect(() => {
    if (answer === undefined || shownAnswered.current) return;
    shownAnswered.current = true;
    answered.value = withTiming(1, right ? RIGHT_FILL : WRONG_FILL);
    if (!chosen) return;
    if (reduceMotion) return;
    if (right) grown.value = withTiming(1, RIGHT_FILL);
    else shift.value = shake();
    // The shared values are stable, and a change of Reduce Motion finds the
    // answer already shown, so only the answer given moves the option.
  }, [answer, right, chosen, reduceMotion, answered, grown, shift]);

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
                { color: tag === undefined ? colors.ink : onFill, fontFamily: fontFamilies.word },
              ]}
            />
          </View>
          {tag === undefined ? null : (
            <Text
              maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
              style={[styles.tag, { color: onFill, fontFamily: fontFamilies.ui }]}
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
function AnswerSheet({ answer, onNext }: { answer: RoundAnswer | undefined; onNext: () => void }) {
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
  const { right } = answer;
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
  screen: { flex: 1 },
  round: { gap: space[5], padding: space[6] },
  options: { gap: roundLayout.gap },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: roundLayout.gap,
    minHeight: minTouchTarget,
    paddingLeft: space[3],
    paddingRight: space[4],
  },
  progress: { flex: 1, gap: roundLayout.tightGap },
  progressText: { fontSize: typeSize.meta, fontWeight: '700' },
  bar: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  lives: { flexDirection: 'row', gap: LIFE_GAP },
  exit: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    minHeight: 220,
    justifyContent: 'center',
    gap: space[4],
    paddingVertical: roundLayout.cardPaddingVertical,
    paddingHorizontal: space[6],
    borderWidth: 1,
  },
  label: { marginHorizontal: space[1] },
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
  tag: { fontSize: typeSize.meta, fontWeight: '700' },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  sheetContent: { gap: roundLayout.sheetGap, paddingHorizontal: space[1], paddingBottom: space[2] },
  sheetTitle: { fontSize: typeSize.blockHeading, fontWeight: '700' },
  sheetAnswer: { fontWeight: '500' },
  example: {
    fontSize: typeSize.blockHeading,
    lineHeight: typeSize.blockHeading * 1.5,
    fontStyle: 'italic',
  },
  author: { marginTop: space[1], fontSize: typeSize.meta, fontWeight: '500' },
  explanation: { fontSize: typeSize.explanation, lineHeight: typeSize.explanation * 1.55 },
  next: { marginTop: roundLayout.tightGap },
});
