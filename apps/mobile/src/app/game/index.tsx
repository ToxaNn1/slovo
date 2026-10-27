import { GAME_LIVES, GAME_ROUNDS, type GameModeOffer } from '@slovo/core';
import {
  DailyCrosswordCard,
  DecorBackground,
  fill,
  GameModeCard,
  GameResult,
  GameRound,
  rowPadding,
  ScreenTitle,
  SectionLabel,
  space,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '../../edition/edition';
import { useOpenScreen } from '../../entries/use-open-screen';
import { useDailyCrosswordCard } from '../../game/daily-crossword';
import { useGameActions, useGameState } from '../../game/game';
import { gameModeCard, gameModeGroups, gameModeStrings, playedOffers } from '../../game/game-modes';
import { useShown } from '../../shown-in-effect';

const { game: strings } = editionStrings;

/** How far the largest text sizes of iOS may scale the line under the title, so it never breaks a word. */
const RULES_MAX_FONT_SCALE = 1.5;

/**
 * The Game tab: the mode screen, a Round with its answer sheet, or the result
 * screen with its Game Review, as the Core's Game stands, while the Game is on
 * in effect. The Game stays in the Core composition, so another tab and back,
 * or an Entry the Game Review opens and back, finds it where it was.
 */
export default function GameScreen() {
  // Turned off remotely while the reader is on it: its tab goes, and so does the screen.
  if (!useShown().tabs.includes('game')) return <Redirect href="/" />;
  return <Game />;
}

function Game() {
  const state = useGameState();
  const actions = useGameActions();
  const router = useRouter();
  const openScreen = useOpenScreen();
  const { gameReview } = useShown();
  const { colors } = useTokens();

  const { current } = state;
  return (
    <SafeAreaView
      testID="game"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      {current === undefined ? (
        <ModeScreen
          modes={playedOffers(state.modes)}
          bestResult={state.bestResults['guess-word']}
          onStart={actions.start}
        />
      ) : current.status === 'won' || current.status === 'lost' ? (
        <GameResult
          game={current}
          bestResult={state.bestResults[current.modeId]}
          onAgain={() => {
            actions.start(current.modeId);
          }}
          onHome={() => {
            actions.leave();
            router.navigate('/');
          }}
          onOpenEntry={
            gameReview
              ? (entryId) => {
                  openScreen(`/game/${entryId}`);
                }
              : undefined
          }
        />
      ) : (
        <GameRound
          game={current}
          label={gameModeStrings(strings.modes, current.modeId).roundLabel}
          onAnswer={actions.answer}
          onNext={actions.next}
          onLeave={actions.leave}
          onOpenLetter={actions.openLetter}
        />
      )}
    </SafeAreaView>
  );
}

/**
 * The mode screen (`game-mode-select-dark`): the title, what a Game of
 * «Вгадай слово» is with its Best result once it has one, the Daily
 * Crossword's card while it is on, which opens its screen, and a card per mode on offer, with its own
 * Best result, under the titles of their groups.
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
  const crossword = useDailyCrosswordCard();
  const openScreen = useOpenScreen();
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
        {crossword === undefined ? null : (
          <DailyCrosswordCard
            testID="daily-crossword"
            {...crossword}
            onPress={() => {
              openScreen('/game/crossword');
            }}
          />
        )}
        {gameModeGroups(modes, strings).map(({ title, offers }) => (
          <View key={title} style={styles.group}>
            <SectionLabel style={styles.groupTitle}>{title}</SectionLabel>
            {offers.map((offer) => (
              <GameModeCard
                key={offer.modeId}
                testID={`game-mode-${offer.modeId}`}
                {...gameModeCard(offer, strings)}
                onPress={() => {
                  onStart(offer.modeId);
                }}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  modes: {
    gap: space[4],
    paddingTop: rowPadding,
    paddingHorizontal: space[5],
    paddingBottom: space[8],
  },
  heading: { gap: space[4], marginHorizontal: space[1], marginBottom: space[2] },
  group: { gap: space[4] },
  groupTitle: { marginHorizontal: space[1], marginTop: space[2] },
  rules: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.5 },
});
