import type {
  AskableEntry,
  CurrentGame,
  GivenAnswer,
  Round,
  RoundAnswer,
  RoundContent,
} from '@slovo/core';
import { answerBannerDelay, sentences } from '@slovo/core';
import type { MascotState } from '@slovo/contracts';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConfirmationDialog } from '../primitives/ConfirmationDialog';
import { fill, useEdition } from '../providers/EditionProvider';
import { useInterfaceSounds } from '../providers/InterfaceSoundsProvider';
import { useTokens } from '../providers/TokensProvider';
import {
  entryCardFrame,
  quickQuestionCard,
  roundLayout,
  roundMascotWidth,
  space,
  swipeStampLayout,
  typeStyle,
} from '../tokens';
import { AnswerBanner } from './AnswerBanner';
import { AnswerSheet, cardLine } from './AnswerSheet';
import { ChipsRound } from './ChipsRound';
import { GameHeader } from './GameHeader';
import { PairsRound } from './PairsRound';
import { PagerScrollView } from '../primitives/VerticalPager';
import { AnswerOptions, PickRound } from './PickRound';
import { RoundCard, RoundKicker } from './RoundCard';
import { RoundLookContext } from './round-look';
import { askedAs, cardOf, RoundHead, type CardText } from './RoundPrompt';
import { TypedRound } from './TypedRound';
import { useGameHaptics } from './useGameHaptics';
import { VowelRound } from './VowelRound';

/**
 * A Round of the Game in play (`game-round-dark`): the header with the ✕, the
 * prompt under its label, the four options and, once answered, the sheet,
 * or the banner when the Core says the answered Round moves on by itself
 * (never after a pair of a pairs grid).
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
 * The question stands on the background with no card, its label
 * without the Round's number and none in the modes the board
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
  mascot,
  onWaitFor = noWait,
}: {
  game: CurrentGame;
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
  /** Draws the Mascot beside the question in a state at a width (`gameRoundMascot`); no Mascot if none. */
  mascot?: ((look: { state: MascotState; width: number }) => ReactNode) | undefined;
  /** Hands the Game what the banner waits for besides its delay: VoiceOver reading it. */
  onWaitFor?: (done: Promise<unknown>) => void;
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
  const { head = 'label', questionFace = 'byLength', card: cardLook } = game.presentation;
  // A mode headed by its title, as «Англіцизми», «АНГЛІЦИЗМИ» (board g5), shows it in the label's place.
  const modeLabel = head === 'title' ? title : label;
  const asked = askedAs(round, modeLabel, strings.game.round);
  const card = cardOf(cardLook, round, asked.prompt, strings.game.round.prompts);
  const look = {
    onGround: true,
    optionStamp: true,
    questionFace,
    inkHeaded: head === 'ink',
    mascot: mascot?.({ state: mascotState(answer, game.lives), width: roundMascotWidth }),
    // The header has no title: the mode and the Round head the question (board «slogo game last»).
    kicker:
      game.roundLimit === undefined
        ? title
        : fill(strings.game.round.header, {
            mode: title,
            n: String(round.number),
            total: String(game.roundLimit),
          }),
  };
  // An ink-headed mode heads its body alone.
  const labelShown = !look.inkHeaded;

  return (
    <View testID="game-round" style={styles.screen}>
      <GameHeader
        roundsPassed={game.roundsPassed}
        missed={new Set(game.played.filter(({ right }) => !right).map(({ number }) => number))}
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.round, round.form !== 'pick' && styles.roundWithoutOptions]}
      >
        {round.form !== 'vowel' && <RoundKicker kicker={look.kicker} />}
        {labelShown && (
          <RoundHead
            label={round.form === 'pairs' ? strings.game.round.pairsHint : asked.label}
            heading={round.form === 'vowel' || round.form === 'pairs'}
            testID={round.form === 'pairs' ? 'game-prompt' : undefined}
          />
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
          onNext={answerBannerDelay(game) === undefined ? onNext : undefined}
        />
      ) : (
        <AnswerSheet
          answer={answer}
          line={
            answer === undefined ? undefined : cardLine(answer.sheet, game.played.at(-1)?.entry)
          }
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
 * The Mascot's state beside the question: waiting while the
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
  // The sheet explains the answer picked on this card, not one kept from an earlier visit. It is
  // kept from the pick, so a card drawn again while the sheet is open shows the same answer,
  // which VoiceOver does not hear again.
  const [picked, setPicked] = useState<RoundAnswer>();
  const explained = answer === undefined ? undefined : picked;
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
            accessibilityLabel={asked.label === title ? title : sentences([asked.label, title])}
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
              setPicked({
                form: 'pick',
                chosen: option,
                correct: round.correct,
                right: option === round.correct,
                sheet: round.sheet,
              });
              onAnswer(option);
            }}
          />
        </PagerScrollView>
      </View>
      <AnswerSheet
        answer={explained}
        line={cardLine(round.sheet, entry)}
        onNext={() => {
          setPicked(undefined);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The Round fills the screen, so its options sit at the bottom.
  round: { flexGrow: 1, gap: space[5], padding: space[6] },
  // The Feed's page frames the Quick Question's card as it does a Word card (owner 16.11).
  // Ends where a framed Word card's face ends: over the room it leaves for the swipe stamp
  // and its offset shadow, so both cards in the Feed are the same height (owner 21.11).
  quickQuestion: { flex: 1, paddingBottom: swipeStampLayout.room + entryCardFrame.shadow },
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
});
