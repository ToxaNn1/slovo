import { fill } from '@slovo/contracts';
import type { GameModeOffer } from '@slovo/core';
import {
  DailyCrosswordCard,
  GameModeCard,
  GameResult,
  GameRound,
  GameModeGroupTitle,
  GamesTitle,
  rowPadding,
  space,
  useTokens,
  WidgetGuideSheet,
  XpPill,
} from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/use-open-screen';
import { useDailyCrosswordCard } from '@/game/daily-crossword';
import { ProgressShareOffers } from '@/game/progress-share-offers';
import {
  useGameActions,
  useGameState,
  usePauseInBackground,
  useTimeLeft,
  useWidgetHintShown,
} from '@/game/game';
import { gameModeCard, gameModeGroups, gameModeStrings } from '@/game/game-modes';
import { MascotAs, MascotIn } from '@/mascot/mascot';
import { useXpLogState } from '@/progress/xp-log';
import { useShown } from '@/shown-in-effect';

const { game: strings, widget: widgetStrings, settings: settingsStrings } = editionStrings;

/**
 * The Game tab: the mode screen, a Round with its answer sheet, or the result
 * screen with its Game Review, as the Core's Game stands, while the Game is on
 * in effect. A result that offers the widget hint shows the widget guide in a
 * sheet over it, until the reader closes it. A timed Game's timer ticks, and stops while the app is in the
 * background. The Game stays in the Core composition, so another tab and back,
 * or an Entry the Game Review opens and back, finds it where it was.
 */
/** The Mascot's width in the Round's head, from the design. */
const ROUND_MASCOT_WIDTH = 88;

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
            mascot={<MascotIn state="gameEnd" onRed />}
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
          mascot={
            current.status === 'answered' ? (
              <MascotIn
                state={current.played.at(-1)?.right === true ? 'gameRight' : 'gameWrong'}
                width={ROUND_MASCOT_WIDTH}
              />
            ) : (
              <MascotAs state="waits" width={ROUND_MASCOT_WIDTH} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

/**
 * The mode screen, as the design's Games screen: the big title, the Daily
 * Crossword's red card while it is on, which opens its screen, and a row per
 * mode on offer, with its own Best result, under the titles of their groups,
 * each after a red mark.
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
      <ScrollView contentContainerStyle={styles.modes}>
        <View style={styles.heading}>
          <GamesTitle>{strings.title}</GamesTitle>
          <TotalXp />
        </View>
        <ProgressShareOffers />
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
            <View style={styles.groupTitle}>
              <GameModeGroupTitle>{title}</GameModeGroupTitle>
            </View>
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

/**
 * The XP earned in all beside the title, while the XP log is on and the
 * reader has not hidden the counters.
 */
function TotalXp() {
  const { total } = useXpLogState();
  if (!useShown().xpBar) return null;
  const count = String(total);
  return (
    <XpPill
      testID="games-xp"
      text={fill(strings.xp, { count })}
      label={fill(settingsStrings.profile.totalXp, { count })}
    />
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
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space[3],
    marginHorizontal: space[1],
    marginBottom: space[2],
  },
  group: { gap: space[1] },
  groupTitle: { marginHorizontal: space[1], marginTop: space[4] },
});
