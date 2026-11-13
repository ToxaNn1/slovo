import { countsAsWon, type GameOver } from '@slovo/core';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import {
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, Pattern, Polygon } from 'react-native-svg';

import { fill, useEdition } from '../providers/EditionProvider';
import { Button } from '../primitives/Button';
import {
  blockGap,
  fontScaleCap,
  halftone,
  mascotWidth,
  resultLayout,
  space,
  typeRoles,
  typeStyle,
  wedges,
} from '../tokens';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { GameReview } from './GameReview';
import { useGameHaptics } from './useGameHaptics';
import { WholeWordsText } from '../primitives/WholeWordsText';

export const TITLE_TRACKING = typeRoles.resultTitle.letterSpacing / typeRoles.resultTitle.size;
/** The Mascot's own width on the panel: its figure and the padding it draws around it. */
const MASCOT_COLUMN = mascotWidth + 2 * space[4];

/**
 * The Mascot beside the title on the red panel, no wider than its figure, as
 * the board sets it. Its line wraps under the figure: unbounded, the line
 * would take its whole width on one line, run off the screen and squeeze the
 * title and line beside it until their words break.
 */
export function PanelMascot({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle> | undefined;
}) {
  return (
    <View testID="game-panel-mascot" style={[styles.mascot, style]}>
      {children}
    </View>
  );
}

/**
 * The red panel's ground, across the screen's width and the panel's height:
 * the accent cut by its slanted bottom edge, under the halftone raster. The
 * panel is at least the board's height and grows with its text, at the
 * largest text sizes too, so the ground follows the height it is laid out at.
 */
export function PanelGround({ color }: { color: string }) {
  const id = `result${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { width } = useWindowDimensions();
  const [height, setHeight] = useState<number>(resultLayout.panelHeight);
  const points = wedges.cut.map(([x, y]) => `${String(x * width)},${String(y * height)}`).join(' ');
  return (
    <View
      testID="game-panel-ground"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={({ nativeEvent }) => {
        setHeight(nativeEvent.layout.height);
      }}
    >
      <Svg
        width={width}
        height={height}
        style={StyleSheet.absoluteFill}
        accessible={false}
        pointerEvents="none"
      >
        <Defs>
          <Pattern
            id={id}
            width={halftone.cell}
            height={halftone.cell}
            patternUnits="userSpaceOnUse"
          >
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
    </View>
  );
}

/**
 * The red panel over a result: the ground, an eyebrow `kicker`, the title and
 * its `line` read as one heading, and the Mascot beside them, or under them
 * when `stacked` (the Lives-over poster, board 07, g9).
 */
export function ResultPanel({
  kicker,
  title,
  line,
  lineTestID,
  mascot,
  stacked = false,
  testID,
}: {
  kicker?: string | undefined;
  title: string;
  line: string | undefined;
  lineTestID?: string;
  mascot: ReactNode;
  stacked?: boolean;
  /** The panel's foot, under the ground. */
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const keyInk = useSchemeColors('light').ink;
  return (
    <View style={styles.panel}>
      <PanelGround color={colors.accent} />
      <View testID={testID} style={[styles.panelFoot, stacked ? styles.stacked : null]}>
        <View
          accessible
          accessibilityRole="header"
          {...voice}
          style={stacked ? styles.stackedText : styles.text}
        >
          {kicker === undefined ? null : (
            <Text
              maxFontSizeMultiplier={fontScaleCap.text}
              style={[typeStyle('eyebrow', tokens), { color: keyInk }]}
            >
              {kicker}
            </Text>
          )}
          <WholeWordsText
            text={title}
            typeRole="resultTitle"
            tracking={TITLE_TRACKING}
            style={[typeStyle('resultTitle', tokens), { color: keyInk }]}
          />
          {line === undefined ? null : (
            <Text
              testID={lineTestID}
              maxFontSizeMultiplier={fontScaleCap.text}
              style={[typeStyle('resultLine', tokens), { color: keyInk }]}
            >
              {line}
            </Text>
          )}
        </View>
        <PanelMascot style={stacked ? styles.stackedMascot : undefined}>{mascot}</PanelMascot>
      </View>
    </View>
  );
}

/** A result button: what it says and does, and how a test finds it. */
interface ResultAction {
  readonly testID: string;
  readonly label: string;
  readonly onPress: () => void;
}

/** The row under a result: the neutral way out, then the red way on, if any, side by side. */
export function ResultButtons({ away, on }: { away: ResultAction; on: ResultAction | undefined }) {
  return (
    <View style={styles.buttons}>
      <View style={styles.button}>
        <Button variant="neutral" {...away} />
      </View>
      {on === undefined ? null : (
        <View style={styles.button}>
          <Button {...on} />
        </View>
      )}
    </View>
  );
}

/** One number of the result: a tile with the word that names it over the value, read as one. */
export function ResultNumber({
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
        maxFontSizeMultiplier={fontScaleCap.text}
        numberOfLines={1}
        style={[typeStyle('eyebrow', tokens), { color: colors.muted }]}
      >
        {label}
      </Text>
      <Text
        maxFontSizeMultiplier={fontScaleCap.number}
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
 * result; a Game in a mode with a time limit ends as a time-up, its right
 * answers in place of the Rounds passed, even when it ran out of Rounds first. The Game Review of every Round follows, while it opens
 * Entries, then «На головну» for the Feed beside «Ще раз» for a new Game in
 * the same mode. A win arrives with the success haptic twice.
 */
export function GameResult({
  game,
  bestResult,
  onAgain,
  onHome,
  onOpenEntry,
  mascot,
}: {
  /** The Game just over, won, lost or with its time up. */
  game: GameOver;
  /** The best result, the Game just over included. */
  bestResult: number | undefined;
  onAgain: () => void;
  onHome: () => void;
  /** Opens the Entry a Round of the Game Review asked about; without it, there is no Game Review. */
  onOpenEntry: ((entryId: string) => void) | undefined;
  /** The Mascot at the Game's end, drawn for the red panel; none without it. */
  mascot?: ReactNode;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, count } = useEdition();
  const words = strings.game;
  const { roundsPassed, roundLimit, lives } = game;
  // A Game in a mode with a time limit counts its right answers, as its Best
  // result does, and arrives as a win does, even when it ran out of Rounds first.
  const timed = game.timeLimit !== undefined;
  const won = countsAsWon(game);
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
      <ResultPanel title={title} line={line} mascot={mascot} />
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
        <ResultButtons
          away={{ testID: 'game-home', label: words.result.home, onPress: onHome }}
          on={{ testID: 'game-again', label: words.result.again, onPress: onAgain }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, paddingBottom: space[8] + space[2] },
  panel: { minHeight: resultLayout.panelHeight, justifyContent: 'flex-end' },
  // The title and line on the left, the Mascot on the right, over the slant.
  panelFoot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[3],
    paddingHorizontal: space[5],
    paddingBottom: resultLayout.panelFootBottom,
  },
  text: { flex: 1, gap: space[2] - 2 },
  // The Lives-over poster (board 07, g9): the title across the panel, the Mascot under it, its figure in line with the text.
  stacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 0 },
  stackedText: { alignSelf: 'stretch', gap: space[2] - 2 },
  // The figure in line with the text, past the padding the Mascot draws around it.
  stackedMascot: { marginLeft: -space[4] },
  mascot: { maxWidth: MASCOT_COLUMN },
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
