import { GAME_ROUNDS, type CurrentGame } from '@slovo/core';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { VictoryIllustration } from '../decor/DecorSlots';
import { fill, useEdition } from '../providers/EditionProvider';
import { PrimaryButton } from '../primitives/PrimaryButton';
import { SecondaryButton } from '../primitives/SecondaryButton';
import { blockGap, resultLayout, space, typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { GameReview } from './GameReview';
import { useGameHaptics } from './useGameHaptics';
import { WholeWordsText } from '../primitives/WholeWordsText';

/** How far the largest text sizes of iOS may scale the numbers, so they keep beside each other. */
const NUMBER_MAX_FONT_SCALE = 1.3;
/** How far they may scale the smaller text, so it never breaks a word. */
const TEXT_MAX_FONT_SCALE = 1.5;
/** The victory illustration's width on a win and on a loss, from the design. */
const WIN_ILLUSTRATION_WIDTH = 120;
const LOSS_ILLUSTRATION_WIDTH = 64;
/** The title's size, from the design. */
const TITLE_SIZE = { fontSize: typeSize.resultTitle, lineHeight: typeSize.resultTitle * 1.1 };

/** One number of the result: the value over the word that names it, read as one. */
function ResultNumber({
  value,
  label,
  spoken,
  testID,
}: {
  value: string;
  label: string;
  /** What VoiceOver reads for it. */
  spoken: string;
  testID: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <View testID={testID} accessible accessibilityLabel={spoken} {...voice} style={styles.number}>
      <Text
        maxFontSizeMultiplier={NUMBER_MAX_FONT_SCALE}
        style={[styles.value, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {value}
      </Text>
      <Text
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        style={[styles.label, { color: colors.muted, fontFamily: fontFamilies.ui }]}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * The result screen (`game-result-win-dark`, `game-result-loss-dark`): the
 * title and the line of a win or a loss, the Rounds passed, the Lives left
 * and the best result when there is one, «Ще раз» for a new Game in the same
 * mode and «На головну» for the Feed. A win arrives with the success haptic
 * twice. The Edition's victory illustration (Decor slot 6) sits over the
 * title, large and stitched in on a win, small and still on a loss. The Game
 * Review of every Round follows the buttons, unless its switch is off.
 */
export function GameResult({
  game,
  bestResult,
  reviewShown,
  onAgain,
  onHome,
  onOpenEntry,
}: {
  /** The Game just over, won or lost. */
  game: CurrentGame;
  /** The best result, the Game just over included. */
  bestResult: number | undefined;
  /** Whether the Game Review shows, which it does while the gameReview Feature Switch is on in effect. */
  reviewShown: boolean;
  onAgain: () => void;
  onHome: () => void;
  /** Opens the Entry a Round of the Game Review asked about. */
  onOpenEntry: (entryId: string) => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice, count } = useEdition();
  const words = strings.game;
  const { roundsPassed, lives } = game;
  const won = game.status === 'won';
  const progress = { passed: String(roundsPassed), total: String(GAME_ROUNDS) };
  const gameHaptics = useGameHaptics();
  // Whether the win has played, so only the screen's arrival plays it.
  const played = useRef(false);

  useEffect(() => {
    if (!won || played.current) return;
    played.current = true;
    gameHaptics.win();
    // New haptics, after a change of Vibration, find the win already played.
  }, [won, gameHaptics]);

  return (
    <ScrollView
      testID="game-result"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.screen}
    >
      <VictoryIllustration
        width={won ? WIN_ILLUSTRATION_WIDTH : LOSS_ILLUSTRATION_WIDTH}
        stitched={won}
      />
      <View accessible {...voice} style={styles.text}>
        <WholeWordsText
          text={won ? words.result.won.title : words.result.lost.title}
          size={TITLE_SIZE}
          tracking={0}
          accessibilityRole="header"
          style={[styles.title, { color: colors.ink, fontFamily: fontFamilies.word }]}
        />
        <Text
          maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
          style={[styles.line, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {won ? count(words.result.won.line, GAME_ROUNDS) : words.result.lost.line}
        </Text>
      </View>
      <View style={styles.numbers}>
        <ResultNumber
          testID="game-result-rounds"
          value={fill(words.round.progress, progress)}
          label={count(words.result.rounds, GAME_ROUNDS)}
          spoken={fill(words.round.progressLabel, progress)}
        />
        <ResultNumber
          testID="game-result-lives"
          value={String(lives)}
          label={count(words.result.lives, lives)}
          spoken={`${String(lives)} ${count(words.result.lives, lives)}`}
        />
        {bestResult === undefined ? null : (
          <ResultNumber
            testID="game-result-best"
            value={String(bestResult)}
            label={count(words.result.best, bestResult)}
            spoken={`${String(bestResult)} ${count(words.result.best, bestResult)}`}
          />
        )}
      </View>
      <View style={styles.buttons}>
        <PrimaryButton testID="game-again" label={words.result.again} onPress={onAgain} />
        <SecondaryButton testID="game-home" label={words.result.home} onPress={onHome} />
      </View>
      <GameReview shown={reviewShown} rounds={game.played} onOpen={onOpenEntry} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: blockGap,
    paddingVertical: space[8] + space[2],
    paddingHorizontal: space[8],
  },
  // Stretched, so the title measures its words against the whole width.
  text: { alignSelf: 'stretch', gap: blockGap },
  title: { fontWeight: '500', textAlign: 'center' },
  line: {
    fontSize: typeSize.explanation,
    lineHeight: typeSize.explanation * 1.5,
    textAlign: 'center',
  },
  numbers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: resultLayout.numbersGap,
    rowGap: space[3],
    marginTop: space[2],
    marginBottom: space[4],
  },
  number: { alignItems: 'center', gap: resultLayout.numberGap },
  value: { fontSize: typeSize.sheetTitle, fontWeight: '500' },
  label: { fontSize: typeSize.smallLabel, fontWeight: '500' },
  buttons: { alignSelf: 'stretch', gap: space[3] },
});
