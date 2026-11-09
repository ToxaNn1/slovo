import type { CurrentGame, GameEnd } from '@slovo/core';
import { type ReactNode, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { Button } from '../primitives/Button';
import { WholeWordsText } from '../primitives/WholeWordsText';
import { blockGap, fontScaleCap, resultLayout, space, typeStyle } from '../tokens';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { PanelGround, PanelMascot, ResultNumber, TITLE_TRACKING } from './GameResult';
import { GameReview } from './GameReview';
import { useGameHaptics } from './useGameHaptics';

/**
 * The end poster of a Game (spec #1674), over the red panel of the result
 * screen. A finished Game and a time-up get the «Фініш» poster, headed «Час!»
 * for a time-up: «Влучно!» for at least half the answers right, else «Ще
 * раунд!»; the right answers out of those played; the XP and Best result
 * tiles; «Новий рекорд!» once the Game beat the record. A Game that lost its
 * last Life gets the Lives-over poster: «Життя закінчилися» over the mode's name and
 * the score out of the Round limit. The Game Review follows, while it opens Entries, then «До
 * ігор» beside «Ще раз!». A Game on target arrives with the success haptic.
 */
export function GameEndPoster({
  game,
  end,
  modeName,
  bestResult,
  onAgain,
  onToGames,
  onOpenEntry,
  mascot,
}: {
  /** The Game just over. */
  game: CurrentGame;
  /** How it ended. */
  end: GameEnd;
  /** The Game Mode's name, e.g. «Вгадай слово». */
  modeName: string;
  /** The best result, the Game just over included. */
  bestResult: number | undefined;
  onAgain: () => void;
  /** Opens the Games hub. */
  onToGames: () => void;
  /** Opens the Entry a Round of the Game Review asked about; without it, there is no Game Review. */
  onOpenEntry: ((entryId: string) => void) | undefined;
  /** The Mascot at the Game's end, drawn for the red panel; none without it. */
  mascot?: ReactNode;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice, count } = useEdition();
  const words = strings.game;
  const keyInk = useSchemeColors('light').ink;
  const onTarget = end.kind !== 'lives-over' && end.onTarget;
  const gameHaptics = useGameHaptics();
  // Whether the success has played, so only the poster's arrival plays it.
  const played = useRef(false);

  useEffect(() => {
    if (!onTarget || played.current) return;
    played.current = true;
    gameHaptics.win();
  }, [onTarget, gameHaptics]);

  const livesOver = end.kind === 'lives-over';
  const panelText = (title: string, line: string | undefined, kicker?: string) => (
    <View accessible {...voice} style={livesOver ? styles.stackedText : styles.text}>
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
        accessibilityRole="header"
        style={[typeStyle('resultTitle', tokens), { color: keyInk }]}
      />
      {line === undefined ? null : (
        <Text
          maxFontSizeMultiplier={fontScaleCap.text}
          style={[typeStyle('resultLine', tokens), { color: keyInk }]}
        >
          {line}
        </Text>
      )}
    </View>
  );

  const finish = words.finish;
  const head = livesOver
    ? panelText(
        words.result.lost.title,
        undefined,
        fill(words.livesOver, {
          mode: modeName.toLocaleUpperCase(voice.accessibilityLanguage),
          score: String(end.right),
          total: String(game.roundLimit ?? end.played),
        }),
      )
    : panelText(
        end.onTarget ? finish.won : finish.more,
        fill(count(finish.hits, end.right), { total: String(end.played) }),
        end.kind === 'time-up' ? finish.timeUp : finish.title,
      );

  return (
    <ScrollView
      testID={`game-end-${end.kind}`}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.screen}
    >
      <View style={styles.panel}>
        <PanelGround color={colors.accent} />
        <View
          testID="game-end-panel-foot"
          style={[styles.panelFoot, livesOver ? styles.stacked : null]}
        >
          {head}
          <PanelMascot style={livesOver ? styles.stackedMascot : undefined}>{mascot}</PanelMascot>
        </View>
      </View>
      <View style={styles.body}>
        {end.kind === 'lives-over' ? null : (
          <>
            {end.newBest ? (
              <Text
                testID="game-end-new-best"
                maxFontSizeMultiplier={fontScaleCap.text}
                style={[typeStyle('eyebrow', tokens), { color: colors.accentText }]}
              >
                {finish.newBest}
              </Text>
            ) : null}
            <View style={styles.numbers}>
              <ResultNumber
                testID="game-end-xp"
                value={fill(finish.xpCount, { count: String(end.xp) })}
                label={finish.xp}
                spoken={`${finish.xp}: ${fill(finish.xpCount, { count: String(end.xp) })}`}
              />
              {bestResult === undefined ? null : (
                <ResultNumber
                  testID="game-end-best"
                  value={String(bestResult)}
                  label={finish.best}
                  spoken={`${finish.best}: ${String(bestResult)}`}
                />
              )}
            </View>
          </>
        )}
        {onOpenEntry === undefined ? null : (
          <GameReview rounds={game.played} onOpen={onOpenEntry} />
        )}
        <View style={styles.buttons}>
          <View style={styles.button}>
            <Button
              variant="neutral"
              testID="game-to-games"
              label={words.finals.toGames}
              onPress={onToGames}
            />
          </View>
          <View style={styles.button}>
            <Button testID="game-again" label={words.finals.again} onPress={onAgain} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, paddingBottom: space[8] + space[2] },
  panel: { minHeight: resultLayout.panelHeight, justifyContent: 'flex-end' },
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
  body: { paddingHorizontal: space[5], gap: blockGap },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', gap: resultLayout.numbersGap },
  buttons: { flexDirection: 'row', gap: space[3] },
  button: { flex: 1 },
});
