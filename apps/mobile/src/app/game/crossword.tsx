import {
  CrossingClueBar,
  CrossingGrid,
  LetterWheel,
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

import { editionStrings } from '@/edition/edition';
import { useCrossingCrossword, type CrossingCrosswordPlay } from '@/game/crossing-crossword';
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
const wheelTexts = {
  tileLabel: (letter: string) => letter,
  check: strings.dailyCrossword.check,
};

/** How far the largest text sizes of iOS may scale the solved line, so it never breaks a word. */
const SOLVED_MAX_FONT_SCALE = 1.5;

/**
 * Today's Daily Crossword, opened from its card on the Game's mode screen:
 * the crossing one played on the Letter Wheel (ADR 0087), or the traced one
 * while the crossing one is off (ADR 0073). The progress stays on the device,
 * so «Назад» and the card's «Продовжити» find it. On a day no pattern fills,
 * or with the crossword turned off while the reader is on it, the screen goes
 * back to the Game.
 */
export default function DailyCrosswordScreen() {
  const crossing = useCrossingCrossword();
  if (crossing === undefined) return <CrosswordFrame />;
  if (crossing.kind === 'play') return <CrossingCrosswordScreen crossword={crossing} />;
  if (crossing.kind === 'no-fill') return <Redirect href="/game" />;
  return <TracedCrossword />;
}

/** The traced Daily Crossword while the crossing one is off (ADR 0073); the Game when it cannot open. */
function TracedCrossword() {
  const traced = useTracedCrossword();
  if (traced === undefined) return <CrosswordFrame />;
  if (traced.kind === 'play') return <TracedCrosswordScreen crossword={traced} />;
  return <Redirect href="/game" />;
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
 * The crossing Daily Crossword (ADR 0087): the current Word's clue bar with
 * «next», the grid, the line on how to trace, long until a Word is solved,
 * and the Letter Wheel; a trace that spells no Word shakes in ink under
 * «Десь закралася помилка. Шукай уважніше!»; «Розв’язано!» once every Word is solved.
 */
function CrossingCrosswordScreen({ crossword }: { crossword: CrossingCrosswordPlay }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const accessibleMode = useScreenReader();
  const { solved, miss } = crossword;
  const texts = strings.dailyCrossword;

  useEffect(() => {
    if (!solved) return;
    AccessibilityInfo.announceForAccessibility(texts.solved);
  }, [solved, texts.solved]);

  useEffect(() => {
    if (miss === undefined) return;
    AccessibilityInfo.announceForAccessibility(texts.miss);
  }, [miss, texts.miss]);

  return (
    <CrosswordFrame>
      <ScrollView contentContainerStyle={styles.content} scrollEnabled={accessibleMode || solved}>
        {!solved && (
          <CrossingClueBar
            testID="crossing-crossword-clue"
            number={crossword.clue.number}
            clue={crossword.clue.text}
            label={crossword.clue.label}
            next={texts.nextWord}
            onNext={crossword.next}
          />
        )}
        <CrossingGrid
          testID="crossing-crossword-grid"
          cells={crossword.cells}
          onSelect={crossword.select}
        />
        {solved ? (
          <Text
            testID="daily-crossword-solved"
            {...voice}
            maxFontSizeMultiplier={SOLVED_MAX_FONT_SCALE}
            style={[typeStyle('crosswordSolved', tokens), styles.solved, { color: colors.correct }]}
          >
            {texts.solved}
          </Text>
        ) : (
          <>
            <Text
              {...voice}
              style={[typeStyle('hint', tokens), styles.solved, { color: colors.muted }]}
            >
              {crossword.entered ? texts.wheelHintShort : texts.wheelHint}
            </Text>
            {miss !== undefined && crossword.trace.length === 0 && (
              <Text
                testID="crossing-crossword-miss"
                {...voice}
                style={[typeStyle('hint', tokens), styles.solved, { color: colors.ink }]}
              >
                {texts.miss}
              </Text>
            )}
            <LetterWheel
              testID="crossing-crossword-wheel"
              letters={crossword.wheel}
              trace={crossword.trace}
              miss={miss}
              coach={crossword.coach}
              accessibleMode={accessibleMode}
              onExtend={crossword.extend}
              onStepBack={crossword.stepBack}
              onRelease={crossword.release}
              texts={wheelTexts}
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
