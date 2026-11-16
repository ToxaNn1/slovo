import type {
  AskableEntry,
  CurrentGame,
  GivenAnswer,
  Round,
  RoundAnswer,
  RoundContent,
  Streak,
} from '@slovo/core';
import type { MascotState } from '@slovo/contracts';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConfirmationDialog } from '../primitives/ConfirmationDialog';
import { fill, useEdition } from '../providers/EditionProvider';
import { useInterfaceSounds } from '../providers/InterfaceSoundsProvider';
import { useTokens } from '../providers/TokensProvider';
import { quickQuestionCard, roundLayout, roundMascotWidth, space, typeStyle } from '../tokens';
import { AnswerBanner } from './AnswerBanner';
import { AnswerSheet, cardLine } from './AnswerSheet';
import { ChipsRound } from './ChipsRound';
import { GameHeader } from './GameHeader';
import { PairsRound } from './PairsRound';
import { PagerScrollView } from '../primitives/VerticalPager';
import { AnswerOptions, PickRound } from './PickRound';
import { RoundCard, RoundKicker } from './RoundCard';
import { RoundLookContext, type QuestionFace } from './round-look';
import { askedAs, cardOf, RoundHead, type CardText } from './RoundPrompt';
import { SurvivalStreak } from './SurvivalStreak';
import { TypedRound } from './TypedRound';
import { useGameHaptics } from './useGameHaptics';
import { VowelRound } from './VowelRound';

/**
 * A Round of the Game in play (`game-round-dark`): the header with the ✕, the
 * prompt under its label, the four options and, once answered, the sheet,
 * or the banner when the Core says the answered Round moves on by itself
 * (`gameAnswerBanner`, never after a pair of a pairs grid); a grid whose found pairs stay
 * (`pairsStay`) shows its large question and no answered state at all.
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
 * On the ground (ADR 0139) the question stands on the background with no
 * card, its label without the Round's number and none in the modes the board
 * heads in ink, the options at the bottom; the Mascot, when given, stands
 * beside the question, waiting, glad, wincing or sad at the last Life lost.
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
  onGround = false,
  optionStamp = false,
  mascot,
  onWaitFor = noWait,
}: {
  game: CurrentGame;
  /** The streak of «Виживання» and its record, which head the Round's body under one solid bar in the header (board g7); none in another mode or with the streak switched off. */
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
  /** Whether the question stands on the background (`gameQuestionOnGround`); on its card, as in spec #1674, if not. */
  onGround?: boolean;
  /** Whether the options take the board's look (`gameOptionStamp`): short ones keyless with a ✓ stamp, ✓ and ✕ keys, the wrong text crossed out; keyed as in spec #1674 if not. */
  optionStamp?: boolean;
  /** Draws the Mascot beside the question in a state at a width (`gameRoundMascot`); no Mascot if none. */
  mascot?: ((look: { state: MascotState; width: number }) => ReactNode) | undefined;
  /** Hands the Game what the banner waits for besides its delay: VoiceOver reading it. */
  onWaitFor?: (done: Promise<unknown>) => void;
}) {
  const { strings, voice } = useEdition();
  const tokens = useTokens();
  const { round } = game;
  const { answer } = round;
  const gameHaptics = useGameHaptics();
  const sounds = useInterfaceSounds();
  // The answer just given: the Round's, or in a timed Game and a grid that stays, which move on at once, the last Round's.
  const stays = round.form === 'pairs' && round.stays;
  const given = game.time === undefined && !stays ? answer : game.played.at(-1)?.answer;
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
  // On the ground «Англіцизми» heads its sentence with the mode's title, «АНГЛІЦИЗМИ» (board g5).
  const modeLabel = onGround && game.modeId === 'anglicism' ? title : label;
  const asked = askedAs(round, modeLabel, strings.game.round);
  const card = cardOf(game.modeId, round, asked.prompt, strings.game.round.prompts, onGround);
  const look = {
    onGround,
    optionStamp,
    questionFace: questionFaceOf(game.modeId),
    inkHeaded: onGround && INK_HEADED.has(game.modeId),
    mascot: mascot?.({ state: mascotState(answer, game.lives), width: roundMascotWidth }),
    // On the ground the header has no title: the mode and the Round head the question (board «slogo game last»).
    kicker: !onGround
      ? undefined
      : game.roundLimit === undefined
        ? title
        : fill(strings.game.round.header, {
            mode: title,
            n: String(round.number),
            total: String(game.roundLimit),
          }),
  };
  // The streak of «Виживання» heads its body alone (board g7), as an ink-headed mode does on the ground.
  const labelShown = streak === undefined && !look.inkHeaded;

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
        onGround={onGround}
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
        contentContainerStyle={[
          styles.round,
          round.form !== 'pick' && styles.roundWithoutOptions,
          onGround && styles.roundOnGround,
        ]}
      >
        {look.kicker !== undefined && round.form !== 'vowel' && (
          <RoundKicker kicker={look.kicker} />
        )}
        {streak !== undefined && <SurvivalStreak streak={streak} />}
        {stays ? (
          <Text
            testID="game-prompt"
            accessibilityRole="header"
            maxFontSizeMultiplier={roundLayout.textMaxFontScale}
            {...voice}
            style={[typeStyle('roundAsk', tokens), { color: tokens.colors.ink }]}
          >
            {strings.game.round.pairsHint}
          </Text>
        ) : (
          labelShown && (
            <RoundHead
              label={round.form === 'pairs' ? strings.game.round.pairsHint : asked.label}
              number={round.number}
              roundLimit={onGround ? undefined : game.roundLimit}
              heading={round.form === 'vowel' || round.form === 'pairs'}
              testID={round.form === 'pairs' ? 'game-prompt' : undefined}
            />
          )
        )}
        <RoundLookContext.Provider value={look}>
          <FormRound
            round={round}
            label={asked.label}
            card={card}
            onAnswer={onAnswer}
            onOpenLetter={onOpenLetter}
          />
        </RoundLookContext.Provider>
      </ScrollView>
      {game.status === 'answered' && game.banner ? (
        <AnswerBanner
          key={round.number}
          answered={game.answered}
          praise={game.played.filter(({ right }) => right).length - 1}
          onWaitFor={onWaitFor}
        />
      ) : (
        <AnswerSheet
          answer={answer}
          line={
            answer === undefined ? undefined : cardLine(answer.sheet, game.played.at(-1)?.entry)
          }
          feedback={feedback}
          onNext={onNext}
        />
      )}
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

/** Waits for nothing besides the banner's delay. */
function noWait(): void {
  // Nothing to wait for.
}

/**
 * The Game Modes the board heads with an ink heading of their own, which
 * draw no red label on the ground: «Наголос», «Впиши слово», «Звідки
 * слово», «Склади вислів» and «Виживання».
 */
const INK_HEADED: ReadonlySet<string> = new Set([
  'stress',
  'type-word',
  'origin',
  'build-idiom',
  'survival',
]);

/**
 * The Game Modes whose question the board sets in the text face on the
 * ground whatever its length: the Definition in «За літерами», the sentence
 * in «Англіцизми», the meaning in «Склади вислів».
 */
const TEXT_FACED: ReadonlySet<string> = new Set(['by-letters', 'anglicism', 'build-idiom']);

/** The face of a Game Mode's question on the ground: «Анаграми» asks its Definition as the large question (board 06). */
function questionFaceOf(modeId: string): QuestionFace {
  if (modeId === 'anagram') return 'display';
  return TEXT_FACED.has(modeId) ? 'text' : 'byLength';
}

/**
 * The Mascot's state beside the question (ADR 0070): waiting while the
 * reader thinks, glad at a right answer, wincing at a wrong one, sad at the
 * wrong one that took the last Life.
 */
function mascotState(answer: RoundAnswer | undefined, lives: number | undefined): MascotState {
  if (answer === undefined) return 'waits';
  if (answer.right) return 'happy';
  return lives === 0 ? 'sad' : 'cringes';
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
        testID="quick-question-card"
        style={[
          styles.quickQuestionCard,
          { backgroundColor: colors.surface, borderColor: colors.line },
        ]}
      >
        {/* The card fills its page and a long question scrolls inside it, never the page (owner, 16.11). */}
        <PagerScrollView
          testID="quick-question-scroll"
          contentContainerStyle={styles.quickQuestionContent}
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
        </PagerScrollView>
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
  quickQuestion: { flex: 1, padding: space[3] },
  quickQuestionCard: {
    flex: 1,
    borderRadius: quickQuestionCard.radius,
    borderWidth: 1,
    overflow: 'hidden',
  },
  quickQuestionContent: {
    gap: quickQuestionCard.gap,
    paddingVertical: quickQuestionCard.paddingVertical,
    paddingHorizontal: quickQuestionCard.paddingHorizontal,
  },
  quickQuestionTag: {
    alignSelf: 'flex-start',
    paddingVertical: quickQuestionCard.tag.paddingVertical,
    paddingHorizontal: quickQuestionCard.tag.paddingHorizontal,
    transform: [{ skewX: quickQuestionCard.tag.skew }],
  },
  // A Round of a form without options keeps one gap more under its content than a pick Round.
  roundWithoutOptions: { paddingBottom: space[6] + space[5] },
  // On the ground the Round fills the screen, so its options sit at the bottom.
  roundOnGround: { flexGrow: 1 },
});
