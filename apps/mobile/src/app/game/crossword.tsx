import {
  CrosswordGrid,
  TracedCrosswordGrid,
  BackHeader,
  Button,
  space,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { edition, editionStrings } from '@/edition/edition';
import { crosswordCellLabel, crosswordKeys, useDailyCrossword } from '@/game/daily-crossword';
import {
  tracedCrosswordTexts,
  useScreenReader,
  useTracedCrossword,
  type TracedCrosswordPlay,
} from '@/game/traced-crossword';
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
  const traced = useTracedCrossword();
  if (traced === undefined) return <CrosswordFrame />;
  if (traced.kind === 'play') return <TracedCrosswordScreen crossword={traced} />;
  return <PrintedCrosswordScreen />;
}

/**
 * The screen's background and its header with «Назад», over the content;
 * empty while the crossword opens.
 */
function CrosswordFrame({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const { colors } = useTokens();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="daily-crossword-screen"
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={styles.header}>
        <BackHeader
          title={strings.dailyCrossword.title}
          titleRole="crosswordHeader"
          back={{
            label: strings.title,
            testID: 'daily-crossword-screen-back',
            onPress: () => {
              router.back();
            },
          }}
        />
      </View>
      {children}
    </View>
  );
}

/**
 * The traced Daily Crossword (ADR 0073): a line on how to play, the grid the
 * reader traces by finger, or taps with VoiceOver on, and its clues;
 * «Розв’язано!» and its Share Card, every cell open with no letter, once
 * every Word is found.
 */
function TracedCrosswordScreen({ crossword }: { crossword: TracedCrosswordPlay }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const accessibleMode = useScreenReader();
  const { solved } = crossword;
  const { shareCard } = useShell();
  const share = useShown().dailyCrosswordShare ? shareCard : undefined;
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!solved) return;
    AccessibilityInfo.announceForAccessibility(strings.dailyCrossword.solved);
  }, [solved]);

  return (
    <CrosswordFrame>
      <ScrollView contentContainerStyle={styles.content} scrollEnabled={accessibleMode || solved}>
        {!solved && (
          <Text {...voice} style={[typeStyle('hint', tokens), { color: colors.muted }]}>
            {strings.dailyCrossword.traceHint}
          </Text>
        )}
        <TracedCrosswordGrid
          testID="traced-crossword-grid"
          grid={crossword.puzzle.grid}
          words={crossword.words}
          trace={crossword.trace}
          miss={crossword.miss}
          accessibleMode={accessibleMode}
          onExtend={crossword.extend}
          onStepBack={crossword.stepBack}
          onRelease={crossword.release}
          texts={tracedCrosswordTexts}
        />
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
              subject={{ puzzle: crossword.puzzle }}
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
    </CrosswordFrame>
  );
}

/**
 * The printed Daily Crossword, while the traced one is off or cannot fill its
 * grid (ADR 0073).
 */
function PrintedCrosswordScreen() {
  const crossword = useDailyCrossword();
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
    // The frame's bottom inset keeps the keyboard's last row, ⌫ with it, above the home indicator.
    <CrosswordFrame>
      <ScrollView contentContainerStyle={styles.content}>
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
    </CrosswordFrame>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: space[4], paddingTop: space[2] },
  content: { gap: space[4], paddingHorizontal: space[5], paddingBottom: space[8] },
  solved: { textAlign: 'center' },
});
