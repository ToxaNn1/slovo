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
  type Streak,
  type TextRange,
} from '@slovo/core';
import { useEffect, useRef, useState } from 'react';
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
import { AnswerCard } from './AnswerCard';
import { AnswerOptions, PickRound } from './PickRound';
import { RoundCard, type RoundFace } from './RoundCard';
import { TypedRound } from './TypedRound';
import { useInterfaceSounds } from '../providers/InterfaceSoundsProvider';
import { useGameHaptics } from './useGameHaptics';
import { VowelRound } from './VowelRound';
import { useReduceMotion } from '../providers/useReduceMotion';
import { WholeWordsText } from '../primitives/WholeWordsText';

/**
 * A lost Life (board 07's `slPop`) turns to the silhouette as it pops from
 * 0.6 past full size and settles, once the wrong choice has filled, when the
 * Round says the Life is lost, as its haptic does. With Reduce Motion it only
 * fades.
 */
const LIFE_POP_UP = {
  duration: roundHeader.lostPop.duration * 0.6,
  easing: Easing.out(Easing.ease),
  reduceMotion: ReduceMotion.Never,
};
const LIFE_POP_DOWN = {
  duration: roundHeader.lostPop.duration * 0.4,
  easing: ease,
  reduceMotion: ReduceMotion.Never,
};
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
  title,
  timeLeft,
  streak,
  feedback = 'sheet',
}: {
  game: CurrentGame;
  /** The streak of «Виживання» and its record, which the header shows in place of the Rounds passed; none in another mode or with the streak switched off. */
  streak?: Streak | undefined;
  /** The Game Mode's title, which the Round's header shows in caps. */
  title: string;
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
  /** How an answer shows: the bottom sheet, or the inline card under the options (`gameAnswerCard`, spec #1674). */
  feedback?: 'sheet' | 'card';
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
  const card = cardOf(game.modeId, round, asked.prompt, strings.game.round.prompts);

  return (
    <View testID="game-round" style={styles.screen}>
      <GameHeader
        title={title}
        number={round.number}
        roundsPassed={game.roundsPassed}
        roundLimit={game.roundLimit}
        lives={game.lives}
        livesAtStart={game.livesAtStart}
        lifeLostAfter={round.lifeLostAfter}
        streak={streak}
        time={
          game.time === undefined || game.timeLimit === undefined
            ? undefined
            : { left: timeLeft ?? game.time.left, limit: game.timeLimit }
        }
        onExit={() => {
          setAsking(true);
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.round, round.form !== 'pick' && styles.roundWithoutOptions]}
      >
        <RoundHead
          label={round.form === 'pairs' ? strings.game.round.pairsHint : asked.label}
          number={round.number}
          roundLimit={game.roundLimit}
          heading={round.form === 'vowel' || round.form === 'pairs'}
          testID={round.form === 'pairs' ? 'game-prompt' : undefined}
        />
        <FormRound
          round={round}
          label={asked.label}
          card={card}
          onAnswer={onAnswer}
          onOpenLetter={onOpenLetter}
        />
        {feedback === 'card' && answer !== undefined ? (
          <AnswerCard right={answer.right} line={cardLine(game, answer)} onNext={onNext} />
        ) : null}
      </ScrollView>
      {feedback === 'sheet' ? <AnswerSheet answer={round.answer} onNext={onNext} /> : null}
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
 * Example with a gap under the gap's label, an Entry's own text asked by its
 * meaning as «{word}» — це…, any other Round's prompt under the mode's label.
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
    case 'meaning':
      return { label, prompt: fill(strings.prompts.meaning, { word: prompt }) };
    case 'mode':
      return { label, prompt };
  }
}

/** What a Round's card shows: its prompt, the part of it to mark and its restyled look. */
interface CardText {
  readonly prompt: string;
  readonly highlight: TextRange | undefined;
  readonly face: RoundFace | undefined;
}

/**
 * The card a Round shows by its Game Mode (board 07 g3, g4, spec #1674):
 * «Впиши слово» names the wrong form over its sentence, «замість «вірогідно»»;
 * «Англіцизм» asks «Чим замінити «{word}»: «{sentence}»?» with the
 * anglicism still marked in the sentence; «Звідки слово» shows its Word on a
 * sunken tile. Any other Round shows its prompt as it is.
 */
function cardOf(
  modeId: string,
  round: Round,
  prompt: string,
  prompts: { readonly instead: string; readonly replace: string },
): CardText {
  const highlight = round.form === 'pick' || round.form === 'typed' ? round.highlight : undefined;
  const plain = { prompt, highlight, face: undefined };
  if (modeId === 'origin' && round.form === 'pick') {
    return { prompt, highlight: undefined, face: { look: 'word' } };
  }
  if (highlight === undefined) return plain;
  const marked = prompt.slice(highlight.start, highlight.end);
  if (modeId === 'type-word' && round.form === 'typed') {
    return {
      prompt,
      highlight,
      face: { look: 'instead', instead: fill(prompts.instead, { wrong: marked }) },
    };
  }
  if (modeId === 'anglicism' && round.form === 'pick') {
    const asked = fill(prompts.replace, { word: marked, sentence: prompt });
    const at = asked.indexOf(prompt);
    if (at < 0) return plain;
    return {
      prompt: asked,
      highlight: { start: at + highlight.start, end: at + highlight.end },
      face: undefined,
    };
  }
  return plain;
}

/**
 * The part of a Round its Answer Form draws under the Round's head: the card
 * and the options, the vowel buttons in the card, the pairs grid, the chips
 * or the typed field under the card.
 */
function FormRound({
  round,
  label,
  card,
  onAnswer,
  onOpenLetter,
}: {
  round: Round;
  label: string;
  card: CardText;
  onAnswer: (given: GivenAnswer) => void;
  onOpenLetter: () => void;
}) {
  const { prompt } = card;
  switch (round.form) {
    case 'pick':
      return <PickRound round={round} label={label} {...card} onAnswer={onAnswer} />;
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
          {...card}
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
 * The Round's header (board 07), one for every Game Mode: a row of the ✕,
 * the mode's title in caps with the Round in play out of the Round limit,
 * and the Lives as flags; under it the 10 segments that fill as the Rounds
 * pass towards the limit, or with no limit the Rounds passed, and in a timed
 * Game the timer under them; then «Життів: 4 з 5» on its red label. A mode without
 * Lives shows no flags and no Lives line.
 */
function GameHeader({
  title,
  number,
  roundsPassed,
  roundLimit,
  lives,
  livesAtStart,
  lifeLostAfter,
  streak,
  time,
  onExit,
}: {
  title: string;
  /** Which Round of the Game is in play, from 1. */
  number: number;
  roundsPassed: number;
  /** The mode's Round limit; none in a mode without one, which shows no bar. */
  roundLimit: number | undefined;
  /** The Lives left; none in a mode without Lives, which shows none. */
  lives: number | undefined;
  /** The Lives the Game started with. */
  livesAtStart: number | undefined;
  /** How long after a wrong answer its Life is lost, in milliseconds. */
  lifeLostAfter: number;
  /** The streak and its record, shown in place of the Rounds passed in a mode with no Round limit. */
  streak: Streak | undefined;
  /** The play time left of a timed Game and its whole time, in milliseconds; none in another Game. */
  time: { left: number; limit: number } | undefined;
  onExit: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice, count } = useEdition();
  const words = strings.game.round;
  const progress = { passed: String(roundsPassed), total: String(roundLimit ?? '') };
  const heading =
    roundLimit === undefined
      ? title
      : fill(words.header, { mode: title, n: String(number), total: String(roundLimit) });
  const filled =
    roundLimit === undefined
      ? 0
      : Math.floor((Math.min(roundsPassed, roundLimit) * roundProgress.segments) / roundLimit);
  const hasLives = lives !== undefined && livesAtStart !== undefined;
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <ExitButton onPress={onExit} />
        <Text
          testID="game-title"
          accessibilityRole="header"
          numberOfLines={1}
          maxFontSizeMultiplier={roundLayout.textMaxFontScale}
          {...voice}
          style={[typeStyle('roundTitle', tokens), styles.title, { color: colors.ink }]}
        >
          {heading}
        </Text>
        {hasLives && (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.lives}
          >
            {Array.from({ length: livesAtStart }, (_, life) => (
              <Life key={life} place={life} full={life < lives} lostAfter={lifeLostAfter} />
            ))}
          </View>
        )}
      </View>
      {roundLimit === undefined && streak !== undefined ? (
        <StreakCounter streak={streak} />
      ) : roundLimit === undefined ? (
        <Text
          testID="game-progress"
          accessibilityLabel={fill(words.passedLabel, progress)}
          maxFontSizeMultiplier={roundLayout.textMaxFontScale}
          {...voice}
          style={[typeStyle('roundLives', tokens), { color: colors.ink }]}
        >
          {fill(words.passed, progress)}
        </Text>
      ) : (
        <View
          testID="game-progress"
          accessible
          accessibilityLabel={fill(words.progressLabel, progress)}
          {...voice}
          style={styles.segments}
        >
          {Array.from({ length: roundProgress.segments }, (_, place) => (
            <View
              key={place}
              testID={`game-progress-${String(place)}`}
              style={[
                styles.segment,
                {
                  backgroundColor:
                    place < filled
                      ? colors.accent
                      : place === filled
                        ? colors.muted
                        : colors.silhouette,
                },
              ]}
            />
          ))}
        </View>
      )}
      {time !== undefined && (
        <GameTimer
          remainingMs={time.left}
          totalMs={time.limit}
          texts={{
            remaining: (seconds) => count(words.timer, seconds),
            shown: (seconds) => fill(words.timerShown, { seconds: String(seconds) }),
          }}
          testID="game-timer"
        />
      )}
      {hasLives && (
        <View style={[styles.livesLabel, { backgroundColor: colors.accent }]}>
          <Text
            testID="game-lives"
            maxFontSizeMultiplier={roundLayout.textMaxFontScale}
            {...voice}
            style={[typeStyle('roundLives', tokens), { color: colors.onAccent }]}
          >
            {fill(words.lives, { count: String(lives), total: String(livesAtStart) })}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * The ✕ at the start of the Round's header (board 07), a 40-pt square, which
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
      hitSlop={(minTouchTarget - roundHeader.exit) / 2}
      style={[styles.exit, { backgroundColor: colors.surfaceSunken }]}
    >
      <Svg width={roundHeader.exitGlyph} height={roundHeader.exitGlyph} viewBox="0 0 14 14">
        <Path d="M0 2L2 0L7 5L12 0L14 2L9 7L14 12L12 14L7 9L2 14L0 12L5 7Z" fill={colors.ink} />
      </Svg>
    </Pressable>
  );
}

/**
 * One Life, a flag: red while full, the silhouette once lost. A Life lost
 * meanwhile turns grey as it pops; with Reduce Motion its fill only fades.
 * Its haptic comes with the wrong answer that cost it.
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
  const scale = useSharedValue(1);
  // Whether the Life showed full before, so only losing it now pops.
  const shownFull = useRef(full);

  useEffect(() => {
    if (full) {
      shownFull.current = true;
      fullness.value = 1;
      return;
    }
    if (!shownFull.current) return;
    shownFull.current = false;
    fullness.value = withDelay(lostAfter, withTiming(0, reduceMotion ? LIFE_FADE : LIFE_POP_UP));
    if (!reduceMotion) {
      scale.value = withDelay(
        lostAfter,
        withSequence(
          withTiming(roundHeader.lostPop.from, { duration: 0 }),
          withTiming(roundHeader.lostPop.peak, LIFE_POP_UP),
          withTiming(1, LIFE_POP_DOWN),
        ),
      );
    }
    // The shared values are stable, and a change of Reduce Motion finds the
    // Life already lost.
  }, [full, reduceMotion, lostAfter, fullness, scale]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fullness.value }));

  const flag = (color: string) => (
    <Wedge
      points={wedges.lifeFlag}
      color={color}
      width={roundHeader.life.width}
      height={roundHeader.life.height}
    />
  );
  return (
    <Animated.View testID={`game-life-${String(place)}`} style={popStyle}>
      {flag(colors.silhouette)}
      <Animated.View
        testID={`game-life-${String(place)}-fill`}
        style={[StyleSheet.absoluteFill, fillStyle]}
      >
        {flag(colors.accent)}
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The Round's head (`game-round-dark`, board 07): its label and place, such
 * as «ВИЗНАЧЕННЯ · 3 / 15», in the red Unbounded, broken only between whole
 * words. The label is the Round's heading for VoiceOver where its card does
 * not read it, a vowel or a pairs Round; the place is the header's to read.
 */
function RoundHead({
  label,
  number,
  roundLimit,
  heading,
  testID,
}: {
  label: string;
  /** Which Round of the Game it is, from 1. */
  number: number;
  /** The mode's Round limit; none in a mode without one, which shows no place. */
  roundLimit: number | undefined;
  /** Whether VoiceOver reads the label as the Round's heading; else the card reads it. */
  heading: boolean;
  testID: string | undefined;
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
    <Text
      testID={testID}
      maxFontSizeMultiplier={roundLayout.textMaxFontScale}
      {...(heading
        ? { accessibilityRole: 'header', accessibilityLabel: label }
        : { accessibilityElementsHidden: true, importantForAccessibility: 'no' })}
      {...voice}
      style={[typeStyle('roundHead', tokens), { color: colors.accent }]}
    >
      {place === undefined ? label : `${label} · ${place}`}
    </Text>
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
 * The answer card's line: the sheet's explanation, such as a Correction's,
 * else the primary Definition of the Entry the Round just played, if it has one.
 */
function cardLine(game: CurrentGame, answer: RoundAnswer): string | undefined {
  if (answer.sheet.explanation !== undefined) return answer.sheet.explanation;
  const entry = game.played.at(-1)?.entry;
  return entry !== undefined && 'primaryDefinition' in entry ? entry.primaryDefinition : undefined;
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

/**
 * The streak of «Виживання» (spec #1674): a big counter of the Rounds passed
 * and «{n} поспіль · рекорд {best}» beside it, read by VoiceOver as that line.
 */
function StreakCounter({ streak }: { streak: Streak }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const line = fill(strings.game.round.survivalStreak, {
    n: String(streak.rounds),
    best: String(streak.record),
  });
  return (
    <View
      testID="game-streak"
      accessible
      accessibilityLabel={line}
      {...voice}
      style={styles.streak}
    >
      <Text
        testID="game-streak-rounds"
        maxFontSizeMultiplier={roundLayout.textMaxFontScale}
        style={[typeStyle('roundStreak', tokens), { color: colors.accent }]}
      >
        {streak.rounds}
      </Text>
      <Text
        testID="game-streak-line"
        maxFontSizeMultiplier={roundLayout.textMaxFontScale}
        style={[typeStyle('roundStreakLine', tokens), styles.streakLine, { color: colors.ink }]}
      >
        {line}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  streak: { flexDirection: 'row', alignItems: 'baseline', gap: roundLayout.gap },
  streakLine: { flexShrink: 1 },
  screen: { flex: 1 },
  round: { gap: space[5], padding: space[6] },
  // A Round of a form without options keeps one gap more under its content than a pick Round.
  roundWithoutOptions: { paddingBottom: space[6] + space[5] },
  header: { gap: roundHeader.gap, paddingHorizontal: space[4] },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: roundHeader.rowGap },
  title: { flex: 1 },
  segments: { flexDirection: 'row', gap: roundProgress.gap },
  segment: { flex: 1, height: roundProgress.height, transform: [{ skewX: roundProgress.skew }] },
  lives: { flexDirection: 'row', gap: roundHeader.lifeGap },
  livesLabel: { alignSelf: 'flex-start', paddingHorizontal: space[2], paddingVertical: space[1] },
  exit: {
    width: roundHeader.exit,
    height: roundHeader.exit,
    borderRadius: roundHeader.exitRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { marginHorizontal: space[1] },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  // The board's banner title sits clear of the slant over the sheet, not on its low edge.
  sheetTitle: { marginTop: space[3] - capitalMarkRoom('roundVerdict') },
  sheetContent: { gap: roundLayout.sheetGap, paddingHorizontal: space[1], paddingBottom: space[2] },
  example: { fontStyle: 'italic' },
  author: { marginTop: space[1] },
  next: { marginTop: roundLayout.tightGap },
});
