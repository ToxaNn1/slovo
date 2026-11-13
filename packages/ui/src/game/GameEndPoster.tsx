import type { CurrentGame, GameEnd } from '@slovo/core';
import { type ReactNode, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { blockGap, fontScaleCap, resultLayout, space, typeStyle } from '../tokens';
import { useTokens } from '../providers/TokensProvider';
import { ResultButtons, ResultNumber, ResultPanel } from './GameResult';
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
  const finish = words.finish;
  const head = livesOver
    ? {
        kicker: fill(words.livesOver, {
          mode: modeName.toLocaleUpperCase(voice.accessibilityLanguage),
          score: String(end.right),
          total: String(game.roundLimit ?? end.played),
        }),
        title: words.result.lost.title,
        line: undefined,
      }
    : {
        kicker: end.kind === 'time-up' ? finish.timeUp : finish.title,
        title: end.onTarget ? finish.won : finish.more,
        line: fill(count(finish.hits, end.right), { total: String(end.played) }),
      };

  return (
    <ScrollView
      testID={`game-end-${end.kind}`}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.screen}
    >
      <ResultPanel {...head} mascot={mascot} stacked={livesOver} testID="game-end-panel-foot" />
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
        <ResultButtons
          away={{ testID: 'game-to-games', label: words.finals.toGames, onPress: onToGames }}
          on={{ testID: 'game-again', label: words.finals.again, onPress: onAgain }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, paddingBottom: space[8] + space[2] },
  body: { paddingHorizontal: space[5], gap: blockGap },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', gap: resultLayout.numbersGap },
});
