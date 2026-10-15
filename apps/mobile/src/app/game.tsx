import { GAME_LIVES, GAME_ROUNDS, type CurrentGame, type GameModeOffer } from '@slovo/core';
import {
  AnswerOption,
  AnswerSheet,
  DecorBackground,
  fill,
  GameHeader,
  GameModeCard,
  GameResult,
  RoundCard,
  ScreenTitle,
  space,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../composition';
import { editionStrings } from '../edition';
import { useGameActions, useGameState } from '../game';
import { LoadFailed } from '../language-pack';

const { game: strings } = editionStrings;

/** How far the largest text sizes of iOS may scale the line under the title, so it never breaks a word. */
const RULES_MAX_FONT_SCALE = 1.5;

/** The words of each Game Mode the app knows, by mode id; a mode without them has no card. */
const modeWords: Readonly<Record<string, typeof strings.guessWord | undefined>> = {
  'guess-word': strings.guessWord,
};

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
        <ModeScreen modes={state?.modes ?? []} onStart={actions.start} />
      ) : current.status === 'won' || current.status === 'lost' ? (
        <GameResult
          won={current.status === 'won'}
          roundsPassed={current.roundsPassed}
          lives={current.lives}
          onAgain={() => {
            actions.start(current.modeId);
          }}
          onHome={() => {
            actions.leave();
            router.navigate('/');
          }}
        />
      ) : (
        <RoundScreen game={current} onAnswer={actions.answer} onNext={actions.next} />
      )}
    </SafeAreaView>
  );
}

/** The mode screen (`game-mode-select-dark`): the title, what a Game is and a card per mode. */
function ModeScreen({
  modes,
  onStart,
}: {
  modes: readonly GameModeOffer[];
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
            {...voice}
            maxFontSizeMultiplier={RULES_MAX_FONT_SCALE}
            style={[styles.rules, { color: colors.muted, fontFamily: fontFamilies.ui }]}
          >
            {fill(strings.rules, {
              rounds: count(strings.rounds, GAME_ROUNDS),
              lives: count(strings.lives, GAME_LIVES),
            })}
          </Text>
        </View>
        {modes.map((offer) => {
          const words = modeWords[offer.modeId];
          if (words === undefined) return null;
          return (
            <GameModeCard
              key={offer.modeId}
              testID={`game-mode-${offer.modeId}`}
              overline={words.overline}
              title={words.title}
              description={words.description}
              sample={words.sample}
              refusal={offer.canStart ? undefined : strings.tooFewEntries}
              onPress={() => {
                onStart(offer.modeId);
              }}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

/** A Round (`game-round-dark`): the header, the prompt, the four options and, once answered, the sheet. */
function RoundScreen({
  game,
  onAnswer,
  onNext,
}: {
  game: CurrentGame;
  onAnswer: (option: number) => void;
  onNext: () => void;
}) {
  const { round } = game;
  return (
    <View testID="game-round" style={styles.screen}>
      <GameHeader roundsPassed={game.roundsPassed} lives={game.lives} />
      <ScrollView contentContainerStyle={styles.round}>
        <RoundCard label={modeWords[game.modeId]?.prompt ?? ''} prompt={round.prompt} />
        <View style={styles.options}>
          {round.options.map((option, place) => (
            <AnswerOption
              key={`${String(round.number)}-${String(place)}`}
              option={option}
              place={place}
              answer={round.answer}
              onPress={() => {
                onAnswer(place);
              }}
            />
          ))}
        </View>
      </ScrollView>
      <AnswerSheet answer={round.answer} onNext={onNext} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  modes: { gap: space[4], paddingTop: 14, paddingHorizontal: space[5], paddingBottom: space[8] },
  heading: { gap: space[4], marginHorizontal: space[1], marginBottom: space[2] },
  rules: { fontSize: 15, lineHeight: 15 * 1.5 },
  round: { gap: space[5], padding: space[6] },
  options: { gap: 10 },
});
