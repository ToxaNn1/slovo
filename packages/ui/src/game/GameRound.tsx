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
  type RoundContent,
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
import { Wedge } from '../primitives/Wedge';
import { Button } from '../primitives/Button';
import {
  minTouchTarget,
  onFill,
  overlineType,
  roundLayout,
  roundProgress,
  space,
  typeSize,
  wedges,
} from '../tokens';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { ease, RIGHT_FILL, WRONG_FILL } from './round-motion';
import { OrderedChips } from './OrderedChips';
import { GameTimer } from './GameTimer';
import { PairsGrid } from './PairsGrid';
import { TypedAnswer } from './TypedAnswer';
import { useGameHaptics } from './useGameHaptics';
import { VowelButtons } from './VowelButtons';
import { useReduceMotion } from '../providers/useReduceMotion';
import { WholeWordsText } from '../primitives/WholeWordsText';

/** A Life's shield and the gap between Lives, from the design. */
const LIFE_SIZE = { width: 18, height: 20 };
const LIFE_GAP = 5;
/** The «−1» that flies up off the Lives when one is lost. */
const LIFE_LOST_MARK = '\u22121';
/** The ✕'s glyph size; its touch target is `minTouchTarget`. */
const EXIT_SIZE = 16;
/** The corners of the ✕'s sunken square. */
const EXIT_RADIUS = 14;
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
 * A lost Life (the design's `slLifeOut`) jumps to 1.6 and −25° in the red and
 * settles back to the silhouette in 600 ms, while «−1» rises 80 pt and fades
 * in 1.1 s (`slXp`). It comes once the wrong choice has filled, when the
 * Round says the Life is lost, as its haptic does.
 */
const LIFE_POP = { scale: 1.6, rotate: -25 };
const LIFE_OUT = {
  duration: 600,
  easing: Easing.out(Easing.ease),
  reduceMotion: ReduceMotion.Never,
};
const LIFE_MARK = { rise: 80, duration: 1100, reduceMotion: ReduceMotion.Never } as const;
/** With Reduce Motion a lost Life's fill and its «−1» only fade (the design's `slRm`). */
const LIFE_FADE = { duration: 300, easing: ease, reduceMotion: ReduceMotion.Never };

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
  mascot,
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
  /** The Mascot on the right of the Round's head, as the Round leaves it; none. */
  mascot?: ReactNode;
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
        results={game.played.map((played) => played.right)}
        current={answer === undefined ? game.played.length : undefined}
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
        <RoundHead
          label={asked.label}
          number={round.number}
          roundLimit={game.roundLimit}
          heading={round.form === 'vowel' || round.form === 'pairs'}
          testID={round.form === 'pairs' ? 'game-prompt' : undefined}
          mascot={mascot}
        />
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
          <PairsGrid
            key={round.number}
            words={round.words}
            definitions={round.definitions}
            answer={answer?.form === 'pairs' ? answer : undefined}
            onAnswer={(word, definition) => {
              onAnswer({ form: 'pairs', word, definition });
            }}
          />
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
            kind={round.chipKind}
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
 * The label and the prompt a Round shows by its label kind: a Synonym Row's
 * question on its dominant, a Tip's own question under the Tip's label, an
 * Example with a gap under the gap's label, any other Round's prompt under
 * the mode's label.
 */
function askedAs(
  { labelKind, prompt }: Round,
  label: string,
  strings: EditionStrings['game']['round'],
): { label: string; prompt: string } {
  switch (labelKind) {
    case 'synonymRow':
      return {
        label: strings.synonymRow.label,
        prompt: fill(strings.synonymRow.prompt, { dominant: prompt }),
      };
    case 'tip':
      return { label: strings.tip.label, prompt };
    case 'gap':
      return { label: strings.gap.label, prompt };
    case 'mode':
      return { label, prompt };
  }
}

/**
 * A Quick Question in the Feed: its title, then one pick Round as the Game
 * draws it, the prompt under the mode's label and the four options. Once
 * answered, the options show the right one and the one picked, with no
 * sheet; the reader turns on to the next card.
 */
export function QuickQuestionRound({
  title,
  round,
  label,
  answered,
  onAnswer,
}: {
  title: string;
  round: Extract<RoundContent, { readonly form: 'pick' }>;
  /** The Game Mode's label over the prompt. */
  label: string;
  /** The option the reader picked; none yet. */
  answered: number | undefined;
  onAnswer: (option: number) => void;
}) {
  const gameHaptics = useGameHaptics();
  const answer = answered === undefined ? undefined : { chosen: answered, correct: round.correct };
  return (
    <View testID="quick-question" style={styles.round}>
      <RoundLabel label={title} />
      <RoundCard
        label={label}
        prompt={round.prompt}
        highlight={round.highlight}
        gap={undefined}
        definition={round.definition}
        labelShown
      />
      <View style={styles.options}>
        {round.options.map((option, place) => (
          <AnswerOption
            key={String(place)}
            option={option}
            place={place}
            answer={answer}
            onPress={() => {
              if (place === round.correct) gameHaptics.rightAnswer();
              else gameHaptics.wrongAnswer();
              onAnswer(place);
            }}
          />
        ))}
      </View>
    </View>
  );
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
  results,
  current,
  time,
  onExit,
}: {
  roundsPassed: number;
  /** Whether each Round played was answered right, in order. */
  results: readonly boolean[];
  /** The place of the Round still to answer; none once it is answered. */
  current: number | undefined;
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
  return (
    <>
      <View style={styles.header}>
        <ExitButton onPress={onExit} />
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
          {roundLimit === undefined ? (
            <Text
              maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
              style={[styles.progressText, { color: colors.ink, fontFamily: fontFamilies.word }]}
            >
              {fill(words.passed, progress)}
            </Text>
          ) : (
            <View testID="game-progress-bar" style={styles.segments}>
              {Array.from({ length: roundLimit }, (_, place) => (
                <View
                  key={place}
                  testID={`game-progress-${String(place)}`}
                  style={[
                    styles.segment,
                    {
                      backgroundColor:
                        place < results.length
                          ? results[place]
                            ? colors.accent
                            : colors.ink
                          : place === current
                            ? colors.muted
                            : colors.silhouette,
                    },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
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
      {time !== undefined && (
        <View style={styles.timer}>
          <GameTimer
            remainingMs={time.left}
            totalMs={time.limit}
            texts={{
              remaining: (seconds) => count(words.timer, seconds),
              shown: (seconds) => fill(words.timerShown, { seconds: String(seconds) }),
            }}
            testID="game-timer"
          />
        </View>
      )}
    </>
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
      style={[styles.exit, { backgroundColor: colors.surfaceSunken }]}
    >
      <Svg width={EXIT_SIZE} height={EXIT_SIZE} viewBox="0 0 20 20">
        <Path
          d="M0 3L3 0L10 7L17 0L20 3L13 10L20 17L17 20L10 13L3 20L0 17L7 10Z"
          fill={colors.ink}
        />
      </Svg>
    </Pressable>
  );
}

/**
 * One Life, a shield: red while full, the silhouette once lost. A Life lost
 * meanwhile jumps out in the red and settles to the silhouette as «−1» flies
 * up off it; with Reduce Motion its fill and the «−1» only fade. Its haptic
 * comes with the wrong answer that cost it.
 */
function Life({
  place,
  full,
  lostAfter,
}: {
  place: number;
  full: boolean;
  /** How long after the wrong answer the Life is lost, in milliseconds: when it jumps. */
  lostAfter: number;
}) {
  const { colors, fontFamilies } = useTokens();
  const reduceMotion = useReduceMotion();
  /** 1 while full, 0 once lost. */
  const fullness = useSharedValue(full ? 1 : 0);
  /** 1 at the jump's height, 0 at rest. */
  const pop = useSharedValue(0);
  /** 0 before the «−1» shows, 1 once it has risen and faded. */
  const mark = useSharedValue(1);
  // Whether the Life showed full before, so only losing it now jumps.
  const shownFull = useRef(full);

  useEffect(() => {
    if (full) {
      shownFull.current = true;
      fullness.value = 1;
      return;
    }
    if (!shownFull.current) return;
    shownFull.current = false;
    mark.value = 0;
    mark.value = withDelay(
      lostAfter,
      withTiming(1, reduceMotion ? LIFE_FADE : { ...LIFE_MARK, easing: Easing.out(Easing.ease) }),
    );
    fullness.value = withDelay(lostAfter, withTiming(0, reduceMotion ? LIFE_FADE : LIFE_OUT));
    if (!reduceMotion) {
      pop.value = withDelay(
        lostAfter,
        withSequence(withTiming(1, { duration: 0 }), withTiming(0, LIFE_OUT)),
      );
    }
    // The shared values are stable, and a change of Reduce Motion finds the
    // Life already lost.
  }, [full, reduceMotion, lostAfter, fullness, pop, mark]);

  const popStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + (LIFE_POP.scale - 1) * pop.value },
      { rotate: `${String(LIFE_POP.rotate * pop.value)}deg` },
    ],
  }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fullness.value }));
  // The «−1» shows from the loss to the end of its flight; with Reduce Motion it fades in place.
  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.value === 0 || mark.value === 1 ? 0 : 1 - mark.value,
    transform: [{ translateY: reduceMotion ? 0 : -LIFE_MARK.rise * mark.value }],
  }));

  const shield = (color: string) => (
    <Wedge points={wedges.shield} color={color} width={LIFE_SIZE.width} height={LIFE_SIZE.height} />
  );
  return (
    <Animated.View testID={`game-life-${String(place)}`} style={popStyle}>
      {shield(colors.silhouette)}
      <Animated.View
        testID={`game-life-${String(place)}-fill`}
        style={[StyleSheet.absoluteFill, fillStyle]}
      >
        {shield(colors.accent)}
      </Animated.View>
      <Animated.View
        testID={`game-life-${String(place)}-lost`}
        style={[styles.lifeLost, markStyle]}
      >
        <Text
          accessible={false}
          style={[styles.lifeLostText, { color: colors.accent, fontFamily: fontFamilies.word }]}
        >
          {LIFE_LOST_MARK}
        </Text>
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
  labelShown = false,
  children,
}: {
  label: string;
  /** Whether the card shows its label over the prompt, as in the Feed; a Game's Round shows it in its head. */
  labelShown?: boolean;
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
      {labelShown && (
        <Text
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          {...voice}
          style={[overlineType, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {label}
        </Text>
      )}
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
 * The Round's head (`game-round-dark`): its label and place, such as
 * «ВИЗНАЧЕННЯ · 3 / 15», in the muted Unbounded, and the Mascot on the
 * right. The label is the Round's heading for VoiceOver where its card does
 * not read it, a vowel or a pairs Round; the place is the header's to read.
 */
function RoundHead({
  label,
  number,
  roundLimit,
  heading,
  testID,
  mascot,
}: {
  label: string;
  /** Which Round of the Game it is, from 1. */
  number: number;
  /** The mode's Round limit; none in a mode without one, which shows no place. */
  roundLimit: number | undefined;
  /** Whether VoiceOver reads the label as the Round's heading; else the card reads it. */
  heading: boolean;
  testID: string | undefined;
  mascot: ReactNode;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  const place =
    roundLimit === undefined
      ? undefined
      : fill(strings.game.round.progress, {
          passed: String(number),
          total: String(roundLimit),
        });
  return (
    <View style={styles.head}>
      <Text
        testID={testID}
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        {...(heading
          ? { accessibilityRole: 'header', accessibilityLabel: label }
          : { accessibilityElementsHidden: true, importantForAccessibility: 'no' })}
        {...voice}
        style={[styles.headLabel, { color: colors.muted, fontFamily: fontFamilies.word }]}
      >
        {place === undefined ? label : `${label} · ${place}`}
      </Text>
      {mascot}
    </View>
  );
}

/**
 * A title over a Quick Question's card, which VoiceOver reads as its heading.
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
 * grows a little, left out with Reduce Motion; nothing shakes.
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
  answer: Pick<PickAnswer, 'chosen' | 'correct'> | undefined;
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
  // Whether the option showed an answer before, so only the answer given now moves.
  const shownAnswered = useRef(answer !== undefined);

  useEffect(() => {
    if (answer === undefined || shownAnswered.current) return;
    shownAnswered.current = true;
    answered.value = withTiming(1, right ? RIGHT_FILL : WRONG_FILL);
    if (chosen && right && !reduceMotion) grown.value = withTiming(1, RIGHT_FILL);
    // The shared values are stable, and a change of Reduce Motion finds the
    // answer already shown, so only the answer given moves the option.
  }, [answer, right, chosen, reduceMotion, answered, grown]);

  const motion = useAnimatedStyle(() => ({
    opacity: dimmed ? 1 - (1 - DIMMED_OPACITY) * answered.value : 1,
    transform: [{ scale: 1 + (RIGHT_SCALE - 1) * grown.value }],
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
        <Button testID="game-next" label={strings.game.sheet.next} onPress={onNext} />
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
  progressText: { fontSize: typeSize.meta, fontWeight: '800' },
  segments: { flexDirection: 'row', gap: roundProgress.gap },
  segment: { flex: 1, height: roundProgress.height, transform: [{ skewX: roundProgress.skew }] },
  lives: { flexDirection: 'row', gap: LIFE_GAP },
  timer: { marginTop: space[3], paddingHorizontal: space[4] },
  lifeLost: { position: 'absolute', top: -space[1], right: 0 },
  lifeLostText: { fontSize: typeSize.meta, fontWeight: '900' },
  exit: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: EXIT_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: roundLayout.gap,
  },
  headLabel: {
    flexShrink: 1,
    fontSize: typeSize.smallLabel,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
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
