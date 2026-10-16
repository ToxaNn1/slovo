import { GAME_LIVES, GAME_ROUNDS, type GameModeOffer } from '@slovo/core';
import {
  DecorBackground,
  fill,
  GameModeCard,
  GameResult,
  GameRound,
  ScreenTitle,
  space,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../composition';
import { editionStrings } from '../edition/edition';
import { useGameActions, useGameState } from '../game/game';
import { gameModeCard, gameModeStrings } from '../game/game-modes';
import { LoadFailed } from '../edition/language-pack';

const { game: strings } = editionStrings;

/** How far the largest text sizes of iOS may scale the line under the title, so it never breaks a word. */
const RULES_MAX_FONT_SCALE = 1.5;

/**
 * The Game tab: the mode screen, a Round with its answer sheet, or the result
 * screen, as the Core's Game stands. The Game stays in the Core composition,
 * so another tab and back finds it where it was.
 */
export default function GameScreen() {
  const composition = useComposition();
  const state = useGameState();
  const actions = useGameActions();
  const router = useRouter();
  const { colors } = useTokens();

  if (composition.status === 'failed') return <LoadFailed onRetry={composition.retry} />;
  const current = state?.current;
  return (
    <SafeAreaView
      testID="game"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      {current === undefined ? (
        <ModeScreen
          modes={state?.modes ?? []}
          bestResult={state?.bestResult}
          onStart={actions.start}
        />
      ) : current.status === 'won' || current.status === 'lost' ? (
        <GameResult
          game={current}
          bestResult={state?.bestResult}
          onAgain={() => {
            actions.start(current.modeId);
          }}
          onHome={() => {
            actions.leave();
            router.navigate('/');
          }}
        />
      ) : (
        <GameRound
          game={current}
          label={gameModeStrings(strings.modes, current.modeId).roundLabel}
          onAnswer={actions.answer}
          onNext={actions.next}
          onLeave={actions.leave}
        />
      )}
    </SafeAreaView>
  );
}

/**
 * The mode screen (`game-mode-select-dark`): the title, what a Game is with
 * the best result once a Game has finished, and a card per mode.
 */
function ModeScreen({
  modes,
  bestResult,
  onStart,
}: {
  modes: readonly GameModeOffer[];
  bestResult: number | undefined;
  onStart: (modeId: string) => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice, count } = useEdition();
  return (
    <View testID="game-modes" style={styles.screen}>
      <DecorBackground />
      <ScrollView contentContainerStyle={styles.modes}>
        <View style={styles.heading}>
          <ScreenTitle>{strings.title}</ScreenTitle>
          <Text
            testID="game-rules"
            {...voice}
            maxFontSizeMultiplier={RULES_MAX_FONT_SCALE}
            style={[styles.rules, { color: colors.muted, fontFamily: fontFamilies.ui }]}
          >
            {fill(strings.rules, {
              rounds: count(strings.rounds, GAME_ROUNDS),
              lives: count(strings.lives, GAME_LIVES),
            })}
            {bestResult === undefined
              ? null
              : ` ${fill(count(strings.best, bestResult), { total: String(GAME_ROUNDS) })}`}
          </Text>
        </View>
        {modes.map((offer) => (
          <GameModeCard
            key={offer.modeId}
            testID={`game-mode-${offer.modeId}`}
            {...gameModeCard(offer, strings.modes)}
            onPress={() => {
              onStart(offer.modeId);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  modes: { gap: space[4], paddingTop: 14, paddingHorizontal: space[5], paddingBottom: space[8] },
  heading: { gap: space[4], marginHorizontal: space[1], marginBottom: space[2] },
  rules: { fontSize: 15, lineHeight: 15 * 1.5 },
});
