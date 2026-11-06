'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import type { EditionStrings } from '@slovo/contracts';
import {
  stressLabel,
  type CurrentGame,
  type GivenAnswer,
  type Round,
  type RoundAnswer,
  type RoundContent,
} from '@slovo/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
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
import { fill, useEdition } from '../providers/EditionProvider';
import { Wedge } from '../primitives/Wedge';
import { Button } from '../primitives/Button';
import {
  capitalMarkRoom,
  minTouchTarget,
  roundHeader,
  roundLayout,
  roundProgress,
  space,
  typeStyle,
  wedges,
} from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { ease } from './round-motion';
import { ChipsRound } from './ChipsRound';
import { GameTimer } from './GameTimer';
import { PairsRound } from './PairsRound';
import { AnswerOptions, PickRound } from './PickRound';
import { RoundCard } from './RoundCard';
import { TypedRound } from './TypedRound';
import { useInterfaceSounds } from '../providers/InterfaceSoundsProvider';
import { useGameHaptics } from './useGameHaptics';
import { VowelRound } from './VowelRound';
import { useReduceMotion } from '../providers/useReduceMotion';
import { WholeWordsText } from '../primitives/WholeWordsText';

/** The «−1» that flies up off the Lives when one is lost. */
const LIFE_LOST_MARK = '\u22121';

/**
 * A lost Life (the design's `slLifeOut`) jumps to 1.6 and −25° in the red and
 * settles back to the silhouette in 600 ms, while «−1» rises 80 pt and fades
 * in 1.1 s (`slXp`). It comes once the wrong choice has filled, when the
 * Round says the Life is lost, as its haptic does.
 */
const LIFE_OUT = {
  duration: 600,
  easing: Easing.out(Easing.ease),
  reduceMotion: ReduceMotion.Never,
};
const LIFE_MARK = { duration: 1100, reduceMotion: ReduceMotion.Never } as const;
/** With Reduce Motion a lost Life's fill and its «−1» only fade (the design's `slRm`). */
const LIFE_FADE = { duration: 300, easing: ease, reduceMotion: ReduceMotion.Never };

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
  const sounds = useInterfaceSounds();
  // The answer just given: the Round's, or in a timed Game, which moves on at once, the last Round's.
  const given = game.time === undefined ? answer : game.played.at(-1)?.answer;
  // The answer shown before, so only the answer given now plays.
  const shownAnswer = useRef(given);

  useEffect(() => {
    if (given === shownAnswer.current) return;
    shownAnswer.current = given;
    if (given === undefined) return;
    sounds.play(given.right ? 'right' : 'wrong');
    if (given.right) gameHaptics.rightAnswer();
    else gameHaptics.wrongAnswer();
    // New haptics or sounds, after a change in Settings, find the answer already played.
  }, [given, gameHaptics, sounds]);

  const [asking, setAsking] = useState(false);
  const exit = strings.game.exit;
  const asked = askedAs(round, label, strings.game.round);

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
        <FormRound
          round={round}
          label={asked.label}
          prompt={asked.prompt}
          onAnswer={onAnswer}
          onOpenLetter={onOpenLetter}
        />
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
 * The part of a Round its Answer Form draws under the Round's head: the card
 * and the options, the vowel buttons in the card, the pairs grid, the chips
 * or the typed field under the card.
 */
function FormRound({
  round,
  label,
  prompt,
  onAnswer,
  onOpenLetter,
}: {
  round: Round;
  label: string;
  prompt: string;
  onAnswer: (given: GivenAnswer) => void;
  onOpenLetter: () => void;
}) {
  switch (round.form) {
    case 'pick':
      return <PickRound round={round} label={label} prompt={prompt} onAnswer={onAnswer} />;
    case 'vowel':
      return <VowelRound round={round} label={label} prompt={prompt} onAnswer={onAnswer} />;
    case 'pairs':
      return <PairsRound round={round} onAnswer={onAnswer} />;
    case 'chips':
      return <ChipsRound round={round} label={label} prompt={prompt} onAnswer={onAnswer} />;
    case 'typed':
      return (
        <TypedRound
          round={round}
          label={label}
          prompt={prompt}
          onAnswer={onAnswer}
          onOpenLetter={onOpenLetter}
        />
      );
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
      <AnswerOptions
        options={round.options}
        answer={answer}
        onPick={(option) => {
          if (option === round.correct) gameHaptics.rightAnswer();
          else gameHaptics.wrongAnswer();
          onAnswer(option);
        }}
      />
    </View>
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
  const tokens = useTokens();
  const { colors } = tokens;
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
              maxFontSizeMultiplier={roundLayout.textMaxFontScale}
              style={[typeStyle('roundPassed', tokens), { color: colors.ink }]}
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
      <Svg width={roundHeader.exitGlyph} height={roundHeader.exitGlyph} viewBox="0 0 20 20">
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
  const tokens = useTokens();
  const { colors } = tokens;
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
      { scale: 1 + (roundHeader.lostPop.scale - 1) * pop.value },
      { rotate: `${String(roundHeader.lostPop.rotate * pop.value)}deg` },
    ],
  }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fullness.value }));
  // The «−1» shows from the loss to the end of its flight; with Reduce Motion it fades in place.
  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.value === 0 || mark.value === 1 ? 0 : 1 - mark.value,
    transform: [{ translateY: reduceMotion ? 0 : -roundHeader.lostMarkRise * mark.value }],
  }));

  const shield = (color: string) => (
    <Wedge
      points={wedges.shield}
      color={color}
      width={roundHeader.life.width}
      height={roundHeader.life.height}
    />
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
        <Text accessible={false} style={[typeStyle('lifeLost', tokens), { color: colors.accent }]}>
          {LIFE_LOST_MARK}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The Round's head (`game-round-dark`): its label and place, such as
 * «ВИЗНАЧЕННЯ · 3 / 15», in the muted Unbounded, and the Mascot on the
 * right, which takes at most `roundLayout.mascotShare` of the row, so a long
 * Mascot line wraps under the figure and the label keeps room to break only
 * between whole words. The label is the Round's heading for VoiceOver where its card does
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
  const tokens = useTokens();
  const { colors } = tokens;
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
        maxFontSizeMultiplier={roundLayout.textMaxFontScale}
        {...(heading
          ? { accessibilityRole: 'header', accessibilityLabel: label }
          : { accessibilityElementsHidden: true, importantForAccessibility: 'no' })}
        {...voice}
        style={[typeStyle('roundHead', tokens), styles.headLabel, { color: colors.muted }]}
      >
        {place === undefined ? label : `${label} · ${place}`}
      </Text>
      <View style={styles.headMascot}>{mascot}</View>
    </View>
  );
}

/**
 * A title over a Quick Question's card, which VoiceOver reads as its heading.
 */
function RoundLabel({ label }: { label: string }) {
  const tokens = useTokens();
  const { voice } = useEdition();
  return (
    <Text
      testID="game-prompt"
      accessibilityRole="header"
      maxFontSizeMultiplier={roundLayout.textMaxFontScale}
      {...voice}
      style={[typeStyle('roundLabel', tokens), styles.label, { color: tokens.colors.muted }]}
    >
      {label}
    </Text>
  );
}

/**
 * The sheet after an answer (`game-round-correct-dark`,
 * `game-round-wrong-dark`, `game-round-correction-answered-light`):
 * «Правильно!» or «Не цього разу», the right answer with its Stress and its
 * Example with the author, or its explanation, or the answer alone, and
 * «Далі», the only way to close it. As the boards draw it, a right answer is
 * on red with ink on it and a wrong one on the Theme's ink; it keeps what it
 * showed while it slides away.
 */
function AnswerSheet({ answer, onNext }: { answer: RoundAnswer | undefined; onNext: () => void }) {
  // The answer it shows, kept while the sheet leaves after «Далі» took the Round's away.
  const [shown, setShown] = useState(answer);
  if (answer !== undefined && answer !== shown) setShown(answer);
  return (
    <BottomSheet
      visible={answer !== undefined}
      tone={shown?.right === true ? 'accent' : 'ink'}
      testID="game-sheet"
    >
      {shown === undefined ? null : <AnswerSheetContent answer={shown} onNext={onNext} />}
    </BottomSheet>
  );
}

function AnswerSheetContent({ answer, onNext }: { answer: RoundAnswer; onNext: () => void }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const { right } = answer;
  const { example, explanation } = answer.sheet;
  return (
    <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
      <Text
        testID="game-sheet-title"
        accessibilityRole="header"
        maxFontSizeMultiplier={roundLayout.textMaxFontScale}
        {...voice}
        style={[typeStyle('roundVerdict', tokens), styles.sheetTitle, { color: colors.ink }]}
      >
        {right ? strings.game.sheet.correct : strings.game.sheet.wrong}
      </Text>
      <WholeWordsText
        text={answer.sheet.answer.text}
        typeRole="roundAnswer"
        accessibilityLabel={stressLabel(
          strings.wordCard,
          answer.sheet.answer.text,
          answer.sheet.answer.stressedVowels,
        )}
        {...voice}
        style={[typeStyle('roundAnswer', tokens), { color: colors.ink }]}
      />
      {example === undefined ? null : (
        <View accessible {...voice}>
          <Text
            maxFontSizeMultiplier={roundLayout.textMaxFontScale}
            style={[typeStyle('example', tokens), styles.example, { color: colors.ink }]}
          >
            {fill(strings.wordCard.example, { text: example.text })}
          </Text>
          {example.author === undefined ? null : (
            <Text
              maxFontSizeMultiplier={roundLayout.textMaxFontScale}
              style={[typeStyle('meta', tokens), styles.author, { color: colors.muted }]}
            >
              {fill(strings.wordCard.exampleAuthor, { author: example.author })}
            </Text>
          )}
        </View>
      )}
      {explanation === undefined ? null : (
        <Text
          testID="game-sheet-explanation"
          maxFontSizeMultiplier={roundLayout.textMaxFontScale}
          {...voice}
          style={[typeStyle('roundExplanation', tokens), { color: colors.ink }]}
        >
          {explanation}
        </Text>
      )}
      <View style={styles.next}>
        <Button
          testID="game-next"
          label={strings.game.sheet.next}
          variant={right ? 'onAccent' : 'primary'}
          onPress={onNext}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  round: { gap: space[5], padding: space[6] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: roundLayout.gap,
    minHeight: minTouchTarget,
    paddingLeft: space[3],
    paddingRight: space[4],
  },
  progress: { flex: 1, gap: roundLayout.tightGap },
  segments: { flexDirection: 'row', gap: roundProgress.gap },
  segment: { flex: 1, height: roundProgress.height, transform: [{ skewX: roundProgress.skew }] },
  lives: { flexDirection: 'row', gap: roundHeader.lifeGap },
  timer: { marginTop: space[3], paddingHorizontal: space[4] },
  lifeLost: { position: 'absolute', top: -space[1], right: 0 },
  exit: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: roundHeader.exitRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: roundLayout.gap,
  },
  headLabel: { flexShrink: 1 },
  headMascot: { flexShrink: 1, maxWidth: roundLayout.mascotShare, alignItems: 'flex-end' },
  label: { marginHorizontal: space[1] },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  // The board's banner title sits clear of the slant over the sheet, not on its low edge.
  sheetTitle: { marginTop: space[3] - capitalMarkRoom('roundVerdict') },
  sheetContent: { gap: roundLayout.sheetGap, paddingHorizontal: space[1], paddingBottom: space[2] },
  example: { fontStyle: 'italic' },
  author: { marginTop: space[1] },
  next: { marginTop: roundLayout.tightGap },
});
