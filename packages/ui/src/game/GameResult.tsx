import type { CurrentGame } from '@slovo/core';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Polygon } from 'react-native-svg';

import { VictoryIllustration } from '../decor/DecorSlots';
import { fill, useEdition } from '../providers/EditionProvider';
import { Button } from '../primitives/Button';
import {
  blockGap,
  halftone,
  resultLayout,
  space,
  typeRoles,
  typeSize,
  typeStyle,
  wedges,
} from '../tokens';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { GameReview } from './GameReview';
import { useGameHaptics } from './useGameHaptics';
import { WholeWordsText } from '../primitives/WholeWordsText';

/** How far the largest text sizes of iOS may scale the numbers, so they keep beside each other. */
const NUMBER_MAX_FONT_SCALE = 1.3;
/** How far they may scale the smaller text, so it never breaks a word. */
const TEXT_MAX_FONT_SCALE = 1.5;
/** The title's size, from the design: the screen title's type, larger. */
const TITLE_SIZE = { fontSize: typeSize.resultTitle, lineHeight: typeSize.resultTitle };
const TITLE_TRACKING = typeRoles.screenTitle.letterSpacing / typeRoles.screenTitle.size;

/**
 * The red panel's ground, across the screen's width: the accent cut by its
 * slanted bottom edge, under the halftone raster.
 */
function PanelGround({ color }: { color: string }) {
  const id = `result${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { width } = useWindowDimensions();
  const height = resultLayout.panelHeight;
  const points = wedges.cut.map(([x, y]) => `${String(x * width)},${String(y * height)}`).join(' ');
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      accessible={false}
      pointerEvents="none"
    >
      <Defs>
        <Pattern id={id} width={halftone.cell} height={halftone.cell} patternUnits="userSpaceOnUse">
          <Circle
            cx={halftone.cell / 2}
            cy={halftone.cell / 2}
            r={halftone.radius}
            fill={halftone.dot}
          />
        </Pattern>
      </Defs>
      <Polygon points={points} fill={color} />
      <Polygon points={points} fill={`url(#${id})`} />
    </Svg>
  );
}

/** One number of the result: a tile with the word that names it over the value, read as one. */
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
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={spoken}
      {...voice}
      style={[styles.number, { backgroundColor: colors.surfaceSunken }]}
    >
      <Text
        maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
        numberOfLines={1}
        style={[typeStyle('eyebrow', tokens), { color: colors.muted }]}
      >
        {label}
      </Text>
      <Text
        maxFontSizeMultiplier={NUMBER_MAX_FONT_SCALE}
        style={[typeStyle('screenTitle', tokens), { color: colors.ink }]}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * The result screen: a red panel cut by a slanted bottom edge under the
 * halftone raster, with the title and the line of a win or a loss in ink and
 * the `mascot` beside them; then tiles of the Rounds passed (out of the mode's
 * Round limit, or alone in a mode without one), the Lives left and the best
 * result; a timed Game ends with its time up, its right answers in place of
 * the Rounds passed. The Game Review of every Round follows, while it opens
 * Entries, then «На головну» for the Feed beside «Ще раз» for a new Game in
 * the same mode. A win arrives with the success haptic twice. The Edition's
 * victory illustration (Decor slot 6) sits high on the panel, large and
 * stitched in on a win, small and still on a loss.
 */
export function GameResult({
  game,
  bestResult,
  onAgain,
  onHome,
  onOpenEntry,
  mascot,
}: {
  /** The Game just over, won or lost. */
  game: CurrentGame;
  /** The best result, the Game just over included. */
  bestResult: number | undefined;
  onAgain: () => void;
  onHome: () => void;
  /** Opens the Entry a Round of the Game Review asked about; without it, there is no Game Review. */
  onOpenEntry: ((entryId: string) => void) | undefined;
  /** The Mascot at the Game's end, drawn for the red panel; none without it. */
  mascot?: ReactNode;
}) {
  const { colors, fontFamilies } = useTokens();
  const { strings, voice, count } = useEdition();
  const words = strings.game;
  const { roundsPassed, roundLimit, lives } = game;
  const won = game.status === 'won';
  // A timed Game ends once its time is up, and counts its right answers.
  const timed = game.time !== undefined;
  const right = game.played.filter((round) => round.right).length;
  const progress = { passed: String(roundsPassed), total: String(roundLimit ?? '') };
  const gameHaptics = useGameHaptics();
  // Whether the win has played, so only the screen's arrival plays it.
  const played = useRef(false);

  useEffect(() => {
    if (!won || played.current) return;
    played.current = true;
    gameHaptics.win();
    // New haptics, after a change of Vibration, find the win already played.
  }, [won, gameHaptics]);

  const keyInk = useSchemeColors('light').ink;
  const title = timed
    ? words.result.timeUp.title
    : won
      ? words.result.won.title
      : words.result.lost.title;
  const line = timed
    ? words.result.timeUp.line
    : won
      ? count(words.result.won.line, roundsPassed)
      : words.result.lost.line;

  return (
    <ScrollView
      testID="game-result"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.screen}
    >
      <View style={styles.panel}>
        <PanelGround color={colors.accent} />
        <View style={styles.illustration}>
          <VictoryIllustration
            width={won ? resultLayout.winIllustration : resultLayout.lossIllustration}
            stitched={won}
          />
        </View>
        <View style={styles.panelFoot}>
          <View accessible {...voice} style={styles.text}>
            <WholeWordsText
              text={title}
              size={TITLE_SIZE}
              tracking={TITLE_TRACKING}
              accessibilityRole="header"
              style={{
                color: keyInk,
                fontFamily: fontFamilies.word,
                fontWeight: typeRoles.screenTitle.weight,
              }}
            />
            <Text
              maxFontSizeMultiplier={TEXT_MAX_FONT_SCALE}
              style={[styles.line, { color: keyInk, fontFamily: fontFamilies.ui }]}
            >
              {line}
            </Text>
          </View>
          {mascot}
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.numbers}>
          {timed ? (
            <ResultNumber
              testID="game-result-right"
              value={String(right)}
              label={count(words.result.right, right)}
              spoken={`${String(right)} ${count(words.result.right, right)}`}
            />
          ) : (
            <ResultNumber
              testID="game-result-rounds"
              value={
                roundLimit === undefined
                  ? String(roundsPassed)
                  : fill(words.round.progress, progress)
              }
              label={count(words.result.rounds, roundLimit ?? roundsPassed)}
              spoken={fill(
                roundLimit === undefined ? words.round.passedLabel : words.round.progressLabel,
                progress,
              )}
            />
          )}
          {lives !== undefined && (
            <ResultNumber
              testID="game-result-lives"
              value={String(lives)}
              label={count(words.result.lives, lives)}
              spoken={`${String(lives)} ${count(words.result.lives, lives)}`}
            />
          )}
          {bestResult === undefined ? null : (
            <ResultNumber
              testID="game-result-best"
              value={String(bestResult)}
              label={count(words.result.best, bestResult)}
              spoken={`${String(bestResult)} ${count(words.result.best, bestResult)}`}
            />
          )}
        </View>
        {onOpenEntry === undefined ? null : (
          <GameReview rounds={game.played} onOpen={onOpenEntry} />
        )}
        <View style={styles.buttons}>
          <View style={styles.button}>
            <Button
              variant="neutral"
              testID="game-home"
              label={words.result.home}
              onPress={onHome}
            />
          </View>
          <View style={styles.button}>
            <Button testID="game-again" label={words.result.again} onPress={onAgain} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, paddingBottom: space[8] + space[2] },
  panel: { height: resultLayout.panelHeight, justifyContent: 'flex-end' },
  illustration: { position: 'absolute', top: resultLayout.illustrationTop, left: space[5] },
  // The title and line on the left, the Mascot on the right, over the slant.
  panelFoot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[3],
    paddingHorizontal: space[5],
    paddingBottom: resultLayout.panelFootBottom,
  },
  text: { flex: 1, gap: space[2] - 2 },
  line: { fontSize: typeSize.button, fontWeight: '700' },
  body: { paddingHorizontal: space[5], gap: blockGap },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', gap: resultLayout.numbersGap },
  number: {
    flexGrow: 1,
    flexBasis: '40%',
    gap: resultLayout.numberGap,
    padding: space[4],
    borderRadius: resultLayout.numberRadius,
  },
  buttons: { flexDirection: 'row', gap: space[3] },
  button: { flex: 1 },
});
