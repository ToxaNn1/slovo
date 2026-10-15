import { GAME_ROUNDS } from '@slovo/core';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { VictoryIllustration } from './DecorSlots';
import { fill, useEdition } from './EditionProvider';
import { useHaptics } from './HapticsProvider';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';
import { space } from './tokens';
import { useTokens } from './TokensProvider';
import { WholeWordsText } from './WholeWordsText';

/** How far the largest text sizes of iOS may scale the numbers, so they keep beside each other. */
const NUMBER_MAX_FONT_SCALE = 1.3;
/** How far they may scale the smaller text, so it never breaks a word. */
const TEXT_MAX_FONT_SCALE = 1.5;
/** The victory illustration's width on a win and on a loss, from the design. */
const WIN_ILLUSTRATION_WIDTH = 120;
const LOSS_ILLUSTRATION_WIDTH = 64;
/** The title's size, from the design. */
const TITLE_SIZE = { fontSize: 38, lineHeight: 38 * 1.1 };
/** How long after the win's first success haptic its second one comes. */
const WIN_SECOND_SUCCESS = 300;

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
 * title, large and stitched in on a win, small and still on a loss.
 */
export function GameResult({
  won,
  roundsPassed,
  lives,
  bestResult,
  onAgain,
  onHome,
}: {
  won: boolean;
  roundsPassed: number;
  lives: number;
  /** The best result, the Game just over included. */
  bestResult: number | undefined;
  onAgain: () => void;
  onHome: () => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice, count } = useEdition();
  const words = strings.game;
  const progress = { passed: String(roundsPassed), total: String(GAME_ROUNDS) };
  const haptics = useHaptics();

  useEffect(() => {
    if (!won) return;
    haptics.success();
    const timer = setTimeout(() => {
      haptics.success();
    }, WIN_SECOND_SUCCESS);
    return () => {
      clearTimeout(timer);
    };
    // The result screen comes anew with every result; only its arrival plays.
  }, []);

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
            testID="game-result-record"
            value={String(bestResult)}
            label={count(words.result.record, bestResult)}
            spoken={`${String(bestResult)} ${count(words.result.record, bestResult)}`}
          />
        )}
      </View>
      <View style={styles.buttons}>
        <PrimaryButton testID="game-again" label={words.result.again} onPress={onAgain} />
        <SecondaryButton testID="game-home" label={words.result.home} onPress={onHome} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingVertical: space[8] + space[2],
    paddingHorizontal: space[8],
  },
  // Stretched, so the title measures its words against the whole width.
  text: { alignSelf: 'stretch', gap: 18 },
  title: { fontWeight: '500', textAlign: 'center' },
  line: { fontSize: 16, lineHeight: 16 * 1.5, textAlign: 'center' },
  numbers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 28,
    rowGap: space[3],
    marginTop: space[2],
    marginBottom: space[4],
  },
  number: { alignItems: 'center', gap: 2 },
  value: { fontSize: 26, fontWeight: '500' },
  label: { fontSize: 12, fontWeight: '500' },
  buttons: { alignSelf: 'stretch', gap: space[3] },
});
