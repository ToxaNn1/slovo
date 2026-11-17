import type { CurrentGame, GameEnd } from '@slovo/core';
import { type ReactNode, useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { fill, useEdition } from '../providers/EditionProvider';
import { Button } from '../primitives/Button';
import { blockGap, fontScaleCap, resultLayout, space, typeRoles, typeStyle } from '../tokens';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { ResultNumber, ResultPanel } from './GameResult';
import { GameReviewOf, type ResultReview } from './GameReview';
import { FlyIn } from './FlyIn';
import { useGameHaptics } from './useGameHaptics';

/** The huge «ФІНІШ» on the red panel (board 06): the result title's face, over twice its size. */
const FINISH_SIZE = Math.round(typeRoles.resultTitle.size * 2.2);

/**
 * The end poster of a Game (spec #1674, brought to the board by spec #1880),
 * over the red panel of the result screen. A finished Game and a time-up get
 * the huge turned «ФІНІШ» flying in, «Час!» for a time-up unless it goes
 * straight to «ФІНІШ» (ADR 0137), then «ВЛУЧНО!» at
 * 60% right or more, else «ЩЕ РАУНД!»; the right answers out of those played;
 * the framed «НОВИЙ РЕКОРД!» stamp once the Game beat the record; the XP and
 * Best result tiles. A Game that lost its last Life gets «Розминка!» with
 * `warmup` on: the mode's name and the score, «Майже. Наступне вийде.», the
 * Mascot at the left and the big count of right answers out of the Rounds
 * played; else the same poster as a finished Game short of its target,
 * «ФІНІШ» and «ЩЕ РАУНД!» with the tiles (board «slogo game last», owner
 * 15.11). The Game Review follows, then «Ще раз!» across the screen and
 * «До ігор» across under it; no «До стрічки» (owner, 15.11). A Game on target arrives with the success haptic.
 */
export function GameEndPoster({
  game,
  end,
  modeName,
  bestResult,
  warmup,
  onAgain,
  onToGames,
  review,
  mascot,
  timeUpToFinish = false,
}: {
  /** The Game just over. */
  game: CurrentGame;
  /** How it ended. */
  end: GameEnd;
  /** The Game Mode's name, e.g. «Вгадай слово». */
  modeName: string;
  /** The best result, the Game just over included. */
  bestResult: number | undefined;
  /** Whether a Game whose Lives ran out ends on «Розминка!» (`livesOverWarmup`). */
  warmup: boolean;
  onAgain: () => void;
  /** Opens the Games hub. */
  onToGames: () => void;
  review: ResultReview;
  /** The Mascot at the Game's end, drawn for the red panel; none without it. */
  mascot?: ReactNode;
  /** Whether a time-up is headed «Фініш» like a finished Game, not «Час!». */
  timeUpToFinish?: boolean;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice, form } = useEdition();
  const keyInk = useSchemeColors('light').ink;
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

  const upper = (text: string) => text.toLocaleUpperCase(voice.accessibilityLanguage);
  const finish = words.finish;
  const kicker = fill(words.livesOver, {
    mode: upper(modeName),
    score: String(end.right),
    total: String(game.roundLimit ?? end.played),
  });
  const hits = `${String(end.right)}/${String(end.played)}`;
  // The board heads every end the same, a Game that lost its last Life «ЩЕ РАУНД!» like one short of its target.
  const finishPanel = (
    <ResultPanel
      title={upper(onTarget ? finish.won : finish.more)}
      // «з 4 влучань»: the noun follows the Rounds played, not the hits.
      line={fill(form(finish.hits, end.played), {
        count: String(end.right),
        total: String(end.played),
      })}
      mascot={mascot}
      banner={
        <View style={styles.banner}>
          <FlyIn>
            <Text
              {...voice}
              maxFontSizeMultiplier={fontScaleCap.number}
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[typeStyle('resultTitle', tokens), styles.finish, { color: keyInk }]}
            >
              {upper(end.kind === 'time-up' && !timeUpToFinish ? finish.timeUp : finish.title)}
            </Text>
          </FlyIn>
          {end.newBest ? (
            <View testID="game-end-new-best" style={[styles.stamp, { borderColor: keyInk }]}>
              <Text
                maxFontSizeMultiplier={fontScaleCap.text}
                style={[typeStyle('eyebrow', tokens), { color: keyInk }]}
              >
                {upper(finish.newBest)}
              </Text>
            </View>
          ) : null}
        </View>
      }
      testID="game-end-panel-foot"
    />
  );
  const panel =
    end.kind === 'lives-over' && warmup ? (
      <ResultPanel
        kicker={kicker}
        title={words.warmup.title}
        line={words.warmup.line}
        mascot={mascot}
        stacked
        beside={
          <View
            testID="game-end-hits"
            accessible
            accessibilityLabel={`${hits} ${words.warmup.hits}`}
            {...voice}
            style={styles.hits}
          >
            <Text
              maxFontSizeMultiplier={fontScaleCap.number}
              style={[typeStyle('resultTitle', tokens), { color: keyInk }]}
            >
              {hits}
            </Text>
            <Text
              maxFontSizeMultiplier={fontScaleCap.text}
              style={[typeStyle('eyebrow', tokens), { color: keyInk }]}
            >
              {upper(words.warmup.hits)}
            </Text>
          </View>
        }
        testID="game-end-panel-foot"
      />
    ) : (
      finishPanel
    );

  return (
    <ScrollView
      testID={`game-end-${end.kind}`}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.screen}
    >
      {panel}
      <View style={styles.body}>
        {end.kind === 'lives-over' && warmup ? null : (
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
        )}
        <GameReviewOf rounds={game.played} review={review} />
        {/* «Ще раз!» the main action across the screen, «До ігор» across under it (owner, 15.11). */}
        <View style={styles.actions}>
          <Button testID="game-again" label={words.finals.again} onPress={onAgain} />
          <Button
            variant="neutral"
            testID="game-to-games"
            label={words.finals.toGames}
            onPress={onToGames}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, paddingBottom: space[8] + space[2] },
  body: { paddingHorizontal: space[5], gap: blockGap },
  numbers: { flexDirection: 'row', flexWrap: 'wrap', gap: resultLayout.numbersGap },
  // The huge «ФІНІШ» and the record stamp over the title, at the panel's left.
  banner: { paddingHorizontal: space[5], gap: space[2], alignItems: 'flex-start' },
  finish: { fontSize: FINISH_SIZE, lineHeight: FINISH_SIZE },
  stamp: {
    borderWidth: 3,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    transform: [{ rotate: '-4deg' }],
  },
  hits: { flex: 1, alignItems: 'flex-end' },
  actions: { gap: space[3] },
});
