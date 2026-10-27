import {
  BackLink,
  CrosswordGrid,
  DecorBackground,
  ScreenTitle,
  space,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AccessibilityInfo, Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '../../edition/edition';
import { crosswordCellLabel, useDailyCrossword } from '../../game/daily-crossword';

const { game: strings } = editionStrings;

/** How far the largest text sizes of iOS may scale the solved line, so it never breaks a word. */
const SOLVED_MAX_FONT_SCALE = 1.5;

/**
 * Today's Daily Crossword, opened from its card on the Game's mode screen:
 * the grid with its clue line and «Відкрити літеру», and «Розв’язано!» in
 * place of the button once every word is right. The letters stay on the
 * device as they go in, so «Назад» and the card's «Продовжити» find them.
 * With the crossword turned off while the reader is on it, the screen goes
 * back to the Game.
 */
export default function DailyCrosswordScreen() {
  const crossword = useDailyCrossword();
  const router = useRouter();
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const solved = crossword?.state.progress === 'solved';

  useEffect(() => {
    if (!solved) return;
    Keyboard.dismiss();
    AccessibilityInfo.announceForAccessibility(strings.dailyCrossword.solved);
  }, [solved]);

  if (crossword === null) return <Redirect href="/game" />;
  return (
    <SafeAreaView
      testID="daily-crossword-screen"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <DecorBackground />
      <View style={styles.back}>
        <BackLink
          testID="daily-crossword-screen-back"
          label={strings.title}
          onPress={() => {
            router.back();
          }}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <ScreenTitle>{strings.dailyCrossword.title}</ScreenTitle>
        {crossword !== undefined && (
          <CrosswordGrid
            testID="daily-crossword-grid"
            letters={crossword.state.letters}
            words={crossword.state.words}
            onLetter={crossword.setLetter}
            onOpenLetter={solved ? undefined : crossword.openCell}
            texts={{
              cellLabel: (letter, place) =>
                crosswordCellLabel(crossword.state.words, strings.letters, letter, place),
              openLetter: strings.openLetter,
            }}
          />
        )}
        {solved && (
          <Text
            testID="daily-crossword-solved"
            {...voice}
            maxFontSizeMultiplier={SOLVED_MAX_FONT_SCALE}
            style={[styles.solved, { color: colors.correct, fontFamily: fontFamilies.word }]}
          >
            {strings.dailyCrossword.solved}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { paddingHorizontal: space[3], paddingTop: space[2] },
  content: { gap: space[4], paddingHorizontal: space[5], paddingBottom: space[8] },
  solved: {
    fontSize: typeSize.emptyStateTitle,
    lineHeight: typeSize.emptyStateTitle * 1.15,
    fontWeight: '500',
    textAlign: 'center',
  },
});
