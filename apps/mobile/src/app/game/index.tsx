import { fill } from '@slovo/contracts';
import type { GameModeOffer } from '@slovo/core';
import {
  CrosswordDayCard,
  GameEndPoster,
  GameModeCard,
  GameRound,
  GameModeGroupTitle,
  GamesTitle,
  type ResultReview,
  rowPadding,
  space,
  UndoToastProvider,
  useTokens,
  useUndoToast,
  XpPill,
} from '@slovo/ui';
import { Redirect } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/use-open-screen';
import { useDailyCrosswordCard } from '@/game/daily-crossword';
import { useGameActions, useGameState, usePauseInBackground, useTimeLeft } from '@/game/game';
import { gameModeCard, gameModeGroups, gameModeStrings, gameModeToast } from '@/game/game-modes';
import { MascotAs } from '@/mascot/mascot';
import { useXpLogState } from '@/progress/xp-log';
import { useShown } from '@/shown-in-effect';

const { game: strings, settings: settingsStrings } = editionStrings;

/**
 * The Game tab: the mode screen, a Round with its answer sheet, or the end
 * poster with its Game Review, whose «До ігор» goes back to the mode screen,
 * as the Core's Game stands, while the Game is on in effect. A timed Game's
 * timer ticks, and stops while the app is in the
 * background. The Game stays in the Core composition, so another tab and back,
 * or an Entry the Game Review opens and back, finds it where it was.
 * A Round's question stands on the ground and the Mascot beside it while
 * their switches are on (ADR 0139).
 */
export default function GameScreen() {
  // Turned off remotely while the reader is on it: its tab goes, and so does the screen.
  if (!useShown().tabs.includes('game')) return <Redirect href="/" />;
  return <Game />;
}

function Game() {
  const state = useGameState();
  const actions = useGameActions();
  const openScreen = useOpenScreen();
  const { gameReview, gameRoundMascot, plainGameReview } = useShown();
  const { colors } = useTokens();
  usePauseInBackground();
  const { current } = state;
  const end = current?.end;

  const timeLeft = useTimeLeft(current?.time);
  const review: ResultReview = !gameReview
    ? { kind: 'none' }
    : plainGameReview
      ? { kind: 'plain' }
      : {
          kind: 'opening',
          onOpen: (entryId) => {
            openScreen(`/game/${entryId}`);
          },
        };
  return (
    <SafeAreaView
      testID="game"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      {current === undefined ? (
        <UndoToastProvider>
          <ModeScreen modes={state.modes} onStart={actions.start} />
        </UndoToastProvider>
      ) : end !== undefined ? (
        <GameEndPoster
          game={current}
          end={end}
          bestResult={state.bestResults[current.modeId]}
          onAgain={() => {
            actions.start(current.modeId);
          }}
          onToGames={actions.leave}
          review={review}
          mascot={
            // The board's Mascot: glad for «ВЛУЧНО!», sad for «ЩЕ РАУНД!» and «Розминка!».
            <MascotAs state={end.kind !== 'lives-over' && end.onTarget ? 'happy' : 'sad'} onRed />
          }
        />
      ) : (
        <GameRound
          game={current}
          timeLeft={timeLeft}
          title={gameModeStrings(strings.modes, current.modeId).title}
          label={gameModeStrings(strings.modes, current.modeId).roundLabel}
          onAnswer={actions.answer}
          onNext={actions.next}
          onLeave={actions.leave}
          onOpenLetter={actions.openLetter}
          mascot={
            gameRoundMascot
              ? ({ state, width }) => <MascotAs state={state} width={width} />
              : undefined
          }
          onWaitFor={actions.waitFor}
        />
      )}
    </SafeAreaView>
  );
}

/**
 * The mode screen, as the design's Games screen: the big title, the Daily
 * Crossword's red card while it is on, which opens its screen, and a row per
 * mode on offer, with its one line and «★ n» or «—», under the titles of
 * their groups, each after a red mark. No progress share offers (DESIGN-06).
 * Behind the switches of board 06 «Хаб ігор»: its five groups, whose rows
 * cascade in, each row's hub line and record, and a mode that can't start
 * keeping its look and showing a toast on a tap instead of starting.
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
  const showToast = useUndoToast();
  const { gameHubGroups, gameHubRecord, gameModeToast: toast } = useShown();
  let place = 0;
  return (
    <View testID="game-modes" style={styles.screen}>
      <ScrollView contentContainerStyle={styles.modes}>
        <View style={styles.heading}>
          <GamesTitle>{strings.title}</GamesTitle>
          <TotalXp />
        </View>
        {crossword !== undefined && (
          <CrosswordDayCard
            testID="daily-crossword"
            title={crossword.title}
            state={crossword.state}
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
                {...gameModeCard(offer, strings, { record: gameHubRecord, toast })}
                {...(gameHubGroups ? { cascadeIndex: place++ } : {})}
                onPress={() => {
                  if (toast && !offer.canStart) {
                    showToast({ message: gameModeToast(offer, modes, strings), brief: true });
                    return;
                  }
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
