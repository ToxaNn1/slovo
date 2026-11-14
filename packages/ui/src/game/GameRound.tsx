import type {
  AskableEntry,
  CurrentGame,
  GivenAnswer,
  Round,
  RoundAnswer,
  RoundContent,
  Streak,
} from '@slovo/core';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConfirmationDialog } from '../primitives/ConfirmationDialog';
import { fill, useEdition } from '../providers/EditionProvider';
import { useInterfaceSounds } from '../providers/InterfaceSoundsProvider';
import { useTokens } from '../providers/TokensProvider';
import { quickQuestionCard, roundLayout, space, typeStyle } from '../tokens';
import { AnswerSheet, cardLine } from './AnswerSheet';
import { ChipsRound } from './ChipsRound';
import { GameHeader } from './GameHeader';
import { PairsRound } from './PairsRound';
import { AnswerOptions, PickRound } from './PickRound';
import { RoundCard } from './RoundCard';
import { askedAs, cardOf, RoundHead, type CardText } from './RoundPrompt';
import { TypedRound } from './TypedRound';
import { useGameHaptics } from './useGameHaptics';
import { VowelRound } from './VowelRound';

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
  /** What the sheet after an answer shows: the answer with its Example, or the answer card (`gameAnswerCard`, spec #1674). */
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
      </ScrollView>
      <AnswerSheet
        answer={answer}
        line={answer === undefined ? undefined : cardLine(answer.sheet, game.played.at(-1)?.entry)}
        feedback={feedback}
        onNext={onNext}
      />
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
 * A Quick Question in the Feed, one card as board f3 draws it: its label on
 * an ink tag, the prompt asked as the Game asks it (a Tip's question under the
 * Tip's label, the non-standard form the Tip replaces under it, «замість
 * «…»»), and the four options with their keys. VoiceOver reads the tag as
 * the card's heading, its label and then the title. Once
 * answered, the options show the right one and the one picked, and the
 * Game's sheet after an answer explains it, right or wrong, until «Далі»
 * closes it; the reader turns on to the next card.
 */
export function QuickQuestionRound({
  title,
  round,
  entry,
  label,
  answered,
  feedback,
  onAnswer,
}: {
  title: string;
  round: Extract<RoundContent, { readonly form: 'pick' }>;
  /** The Entry asked about, whose Definition the answer card explains the answer with. */
  entry: AskableEntry;
  /** The Game Mode's label, over the prompt of a Round asked under the mode's label. */
  label: string;
  /** The option the reader picked; none yet. */
  answered: number | undefined;
  /** What the sheet after an answer shows, as in the Game (`gameAnswerCard`). */
  feedback: 'sheet' | 'card';
  onAnswer: (option: number) => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const asked = askedAs(round, label, strings.game.round);
  const instead =
    entry.kind === 'tip' && entry.nonStandardForm !== undefined
      ? fill(strings.game.round.prompts.instead, { wrong: entry.nonStandardForm })
      : undefined;
  const gameHaptics = useGameHaptics();
  const answer = answered === undefined ? undefined : { chosen: answered, correct: round.correct };
  // The sheet explains the answer picked on this card, not one kept from an earlier visit.
  const [explaining, setExplaining] = useState(false);
  const explained: RoundAnswer | undefined =
    explaining && answer !== undefined
      ? { form: 'pick', ...answer, right: answer.chosen === answer.correct, sheet: round.sheet }
      : undefined;
  return (
    <View testID="quick-question" style={styles.quickQuestion}>
      <View
        style={[
          styles.quickQuestionCard,
          { backgroundColor: colors.surface, borderColor: colors.line },
        ]}
      >
        <View
          testID="quick-question-tag"
          accessible
          accessibilityRole="header"
          // The tag's visible label first, so the name VoiceOver reads holds what it shows;
          // a label that is the title itself, the Word Meaning question's, is read once.
          accessibilityLabel={asked.label === title ? title : `${asked.label}. ${title}`}
          style={[styles.quickQuestionTag, { backgroundColor: colors.ink }]}
        >
          <Text
            maxFontSizeMultiplier={roundLayout.textMaxFontScale}
            {...voice}
            style={[typeStyle('quickQuestionTag', tokens), { color: colors.background }]}
          >
            {asked.label}
          </Text>
        </View>
        <RoundCard
          label={asked.label}
          prompt={asked.prompt}
          highlight={round.highlight}
          gap={undefined}
          definition={round.definition}
          quickQuestion={{ instead }}
        />
        <AnswerOptions
          options={round.options}
          answer={answer}
          inQuickQuestion
          onPick={(option) => {
            if (option === round.correct) gameHaptics.rightAnswer();
            else gameHaptics.wrongAnswer();
            setExplaining(true);
            onAnswer(option);
          }}
        />
      </View>
      <AnswerSheet
        answer={explained}
        line={cardLine(round.sheet, entry)}
        feedback={feedback}
        onNext={() => {
          setExplaining(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  round: { gap: space[5], padding: space[6] },
  // The Feed's page pads the Quick Question's card as board f3 does its cards.
  quickQuestion: { padding: space[3] },
  quickQuestionCard: {
    gap: quickQuestionCard.gap,
    paddingVertical: quickQuestionCard.paddingVertical,
    paddingHorizontal: quickQuestionCard.paddingHorizontal,
    borderRadius: quickQuestionCard.radius,
    borderWidth: 1,
  },
  quickQuestionTag: {
    alignSelf: 'flex-start',
    paddingVertical: quickQuestionCard.tag.paddingVertical,
    paddingHorizontal: quickQuestionCard.tag.paddingHorizontal,
    transform: [{ skewX: quickQuestionCard.tag.skew }],
  },
  // A Round of a form without options keeps one gap more under its content than a pick Round.
  roundWithoutOptions: { paddingBottom: space[6] + space[5] },
});
