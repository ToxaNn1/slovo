import { GAME_ROUNDS } from '@slovo/core';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from './EditionProvider';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';
import { space } from './tokens';
import { useTokens } from './TokensProvider';
import { WholeWordsText } from './WholeWordsText';

/** How far the largest text sizes of iOS may scale the numbers, so they keep beside each other. */
const NUMBER_MAX_FONT_SCALE = 1.3;
/** How far they may scale the smaller text, so it never breaks a word. */
const TEXT_MAX_FONT_SCALE = 1.5;
/** The title's size, from the design. */
const TITLE_SIZE = { fontSize: 38, lineHeight: 38 * 1.1 };

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
 * title and the line of a win or a loss, the Rounds passed and the Lives
 * left, «Ще раз» for a new Game in the same mode and «На головну» for the
 * Feed. `illustration` sits over the title.
 */
export function GameResult({
  won,
  roundsPassed,
  lives,
  onAgain,
  onHome,
  illustration,
}: {
  won: boolean;
  roundsPassed: number;
  lives: number;
  onAgain: () => void;
  onHome: () => void;
  illustration?: ReactNode;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice, count } = useEdition();
  const words = strings.game;
  const progress = { passed: String(roundsPassed), total: String(GAME_ROUNDS) };
  return (
    <ScrollView
      testID="game-result"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.screen}
    >
      {illustration}
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
