import type { GameModeOffer } from '@slovo/core';
import {
  DailyCrosswordCard,
  DecorBackground,
  GameModeCard,
  GameResult,
  GameRound,
  rowPadding,
  ScreenTitle,
  SectionLabel,
  space,
  useTokens,
  WidgetGuideSheet,
} from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/entries/use-open-screen';
import { useDailyCrosswordCard } from '@/game/daily-crossword';
import {
  useGameActions,
  useGameState,
  usePauseInBackground,
  useTimeLeft,
  useWidgetHintShown,
} from '@/game/game';
import { gameModeCard, gameModeGroups, gameModeStrings } from '@/game/game-modes';
import { useShown } from '@/shown-in-effect';

const { game: strings, widget: widgetStrings } = editionStrings;

/**
 * The Game tab: the mode screen, a Round with its answer sheet, or the result
 * screen with its Game Review, as the Core's Game stands, while the Game is on
 * in effect. A result that offers the widget hint shows the widget guide in a
 * sheet over it, until the reader closes it. A timed Game's timer ticks, and stops while the app is in the
 * background. The Game stays in the Core composition, so another tab and back,
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
  usePauseInBackground();
  /** Whether the reader closed the widget hint, which is offered once ever. */
  const [hintClosed, setHintClosed] = useState(false);
  const { current } = state;
  const result = current?.status === 'won' || current?.status === 'lost';
  const hintShown = result && state.widgetHint && !hintClosed;
  useWidgetHintShown(hintShown);

  const timeLeft = useTimeLeft(current?.time);
  return (
    <SafeAreaView
      testID="game"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      {current === undefined ? (
        <ModeScreen modes={state.modes} onStart={actions.start} />
      ) : result ? (
        <>
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
          <WidgetGuideSheet
            visible={hintShown}
            title={widgetStrings.guide.title}
            closeLabel={widgetStrings.guide.close}
            onClose={() => {
              setHintClosed(true);
            }}
            steps={widgetStrings.guide.steps}
            caption={widgetStrings.guide.sizes}
            mode={widgetStrings.allEntries}
            {...widgetStrings.guide.sample}
          />
        </>
      ) : (
        <GameRound
          game={current}
          timeLeft={timeLeft}
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
 * The mode screen (`game-mode-select-dark`): the title, the Daily Crossword's
 * card while it is on, which opens its screen, and a card per mode on offer,
 * with its own Best result, under the titles of their groups.
 */
function ModeScreen({
  modes,
  onStart,
}: {
  modes: readonly GameModeOffer[];
  onStart: (modeId: string) => void;
}) {
  const crossword = useDailyCrosswordCard();
  const openScreen = useOpenScreen();
  return (
    <View testID="game-modes" style={styles.screen}>
      <DecorBackground />
      <ScrollView contentContainerStyle={styles.modes}>
        <View style={styles.heading}>
          <ScreenTitle>{strings.title}</ScreenTitle>
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
  heading: { marginHorizontal: space[1], marginBottom: space[2] },
  group: { gap: space[4] },
  groupTitle: { marginHorizontal: space[1], marginTop: space[2] },
});
