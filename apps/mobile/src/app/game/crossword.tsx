import {
  BackLink,
  CrosswordGrid,
  DecorBackground,
  ScreenTitle,
  Button,
  space,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { edition, editionStrings } from '@/edition/edition';
import { crosswordCellLabel, crosswordKeys, useDailyCrossword } from '@/game/daily-crossword';
import { ShareCardSheet } from '@/share/share-card-sheet';
import { useShell } from '@/shell-value';
import { useShown } from '@/shown-in-effect';

const { game: strings } = editionStrings;
const keys = crosswordKeys(edition.languageTraits);

/** How far the largest text sizes of iOS may scale the solved line, so it never breaks a word. */
const SOLVED_MAX_FONT_SCALE = 1.5;

/**
 * Today's Daily Crossword, opened from its card on the Game's mode screen:
 * the grid with its clue bar, «Відкрити літеру» and the Edition's keyboard, and «Розв’язано!» in
 * place of the button once every word is right. The letters stay on the
 * device as they go in, so «Назад» and the card's «Продовжити» find them.
 * With the crossword turned off while the reader is on it, the screen goes
 * back to the Game. A solved one offers its Share Card, the grid without a
 * letter, while that card is on in effect and the binary can capture it.
 */
export default function DailyCrosswordScreen() {
  const crossword = useDailyCrossword();
  const router = useRouter();
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const solved = crossword?.state.progress === 'solved';
  const { shareCard } = useShell();
  const share = useShown().dailyCrosswordShare ? shareCard : undefined;
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!solved) return;
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
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle>{strings.dailyCrossword.title}</ScreenTitle>
        {crossword !== undefined && (
          <CrosswordGrid
            testID="daily-crossword-grid"
            letters={crossword.state.letters}
            words={crossword.state.words}
            keys={keys}
            onLetter={crossword.setLetter}
            onOpenLetter={solved ? undefined : crossword.openCell}
            texts={{
              cellLabel: (letter, place) =>
                crosswordCellLabel(crossword.state.words, strings, letter, place),
              openLetter: strings.openLetter,
              eraseKey: strings.dailyCrossword.eraseKey,
            }}
          />
        )}
        {solved && (
          <Text
            testID="daily-crossword-solved"
            {...voice}
            maxFontSizeMultiplier={SOLVED_MAX_FONT_SCALE}
            style={[typeStyle('crosswordSolved', tokens), styles.solved, { color: colors.correct }]}
          >
            {strings.dailyCrossword.solved}
          </Text>
        )}
        {solved && share !== undefined && (
          <>
            <Button
              variant="neutral"
              testID="daily-crossword-share"
              label={editionStrings.share.button}
              onPress={() => {
                setSharing(true);
              }}
            />
            <ShareCardSheet
              subject={{ crossword: crossword.state }}
              kind="dailyCrossword"
              share={share}
              visible={sharing}
              onClose={() => {
                setSharing(false);
              }}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { paddingHorizontal: space[3], paddingTop: space[2] },
  content: { gap: space[4], paddingHorizontal: space[5], paddingBottom: space[8] },
  solved: { textAlign: 'center' },
});
