import type { CrossingCrossword, CrosswordSolve } from '@slovo/core';
import {
  CrossingClueBar,
  CrossingGrid,
  LetterWheel,
  BackHeader,
  CrosswordSolvedPoster,
  UndoToastProvider,
  useUndoToast,
  space,
  typeStyle,
  useEdition,
  useTokens,
  fontScaleCap,
} from '@slovo/ui';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { logError } from '@/diagnostics/log';
import { editionStrings } from '@/edition/edition';
import { crosswordShare } from '@/game/crossword-share';
import { useCrossingCrossword, type CrossingCrosswordPlay } from '@/game/crossing-crossword';
import { useDailyCrossword } from '@/game/daily-crossword';
import { useScreenReader } from '@/game/screen-reader';
import { MascotAs } from '@/mascot/mascot';
import { useEditionInEffect } from '@/edition/remote-switches';

const { game: strings } = editionStrings;
const wheelTexts = {
  tileLabel: (letter: string) => letter,
  check: strings.dailyCrossword.check,
};

/**
 * Today's Daily Crossword, opened from its card on the Game's mode screen:
 * the crossing one played on the Letter Wheel. The progress stays on the device,
 * so «Назад» and the card's «Продовжити» find it; a day solved on another
 * device opens solved. On a day no pattern fills, when it cannot open, or
 * with the crossword turned off while the reader is on it, the screen goes
 * back to the Game.
 */
export default function DailyCrosswordScreen() {
  const opening = useDailyCrossword();
  if (opening === undefined) return <CrosswordFrame />;
  if (opening.kind === 'open') return <CrossingCrosswordScreen opened={opening.crossword} />;
  return <Redirect href="/game" />;
}

/**
 * The screen's background and its header with «Назад», over the content;
 * empty while the crossword opens.
 */
function CrosswordFrame({
  children,
  action,
}: {
  children?: ReactNode;
  action?: { label: string; onPress: () => void } | undefined;
}) {
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
          action={action}
        />
      </View>
      {children}
    </View>
  );
}

/**
 * The crossing Daily Crossword, as board 08 orders it: the grid,
 * the current Word's clue bar with «next» under it, the line on how to trace,
 * long until a Word is solved, and the Letter Wheel at the foot; a trace that spells no Word shakes in ink under
 * «Десь закралася помилка. Шукай уважніше!»; «Розв’язано!» once every Word is solved.
 */
function CrossingCrosswordScreen({ opened }: { opened: CrossingCrossword }) {
  const crossword = useCrossingCrossword(opened);
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const accessibleMode = useScreenReader();
  const { solve, miss } = crossword;
  const solved = solve !== undefined;
  const texts = strings.dailyCrossword;
  const inEffect = useEditionInEffect();
  const solvedScreen = inEffect.isFeatureEnabled('crosswordSolvedScreen');
  const solvedText = solvedScreen ? texts.solvedScreen.title : texts.solved;
  // While the finger traces the wheel the screen holds still, and the grid shrinks to leave the
  // Letter Wheel whole on a short screen; with VoiceOver on or once solved, it scrolls instead.
  const scrolls = accessibleMode || solved;

  useEffect(() => {
    if (!solved) return;
    AccessibilityInfo.announceForAccessibility(solvedText);
  }, [solved, solvedText]);

  useEffect(() => {
    if (miss === undefined) return;
    AccessibilityInfo.announceForAccessibility(texts.miss);
  }, [miss, texts.miss]);

  if (solve !== undefined && solvedScreen) {
    return (
      <UndoToastProvider>
        <CrossingCrosswordSolved
          crossword={crossword}
          solve={solve}
          withTime={inEffect.isFeatureEnabled('crosswordSolveTime')}
        />
      </UndoToastProvider>
    );
  }

  return (
    <CrosswordFrame
      action={
        crossword.hint === undefined || solved
          ? undefined
          : { label: texts.hint, onPress: crossword.hint }
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.crossing, scrolls ? styles.fill : styles.fit]}
        scrollEnabled={scrolls}
      >
        <CrossingGrid
          testID="crossing-crossword-grid"
          cells={crossword.cells}
          onSelect={crossword.select}
        />
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
        {solved ? (
          <Text
            testID="daily-crossword-solved"
            {...voice}
            maxFontSizeMultiplier={fontScaleCap.text}
            style={[
              typeStyle('crosswordSolved', tokens),
              styles.solved,
              styles.crossingSolved,
              { color: colors.correct },
            ]}
          >
            {texts.solved}
          </Text>
        ) : (
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
            help={
              <>
                <Text
                  {...voice}
                  style={[typeStyle('hint', tokens), styles.solved, { color: colors.muted }]}
                >
                  {crossword.entered ? texts.wheelHintShort : texts.wheelHint}
                </Text>
                {miss !== undefined && (
                  <Text
                    testID="crossing-crossword-miss"
                    {...voice}
                    style={[typeStyle('hint', tokens), styles.solved, { color: colors.ink }]}
                  >
                    {texts.miss}
                  </Text>
                )}
              </>
            }
            texts={wheelTexts}
          />
        )}
      </ScrollView>
    </CrosswordFrame>
  );
}

/**
 * The solved screen of the crossing Daily Crossword: «Розгадано!»
 * with the Solve time and the Mascot celebrating, the grid with no letter and
 * the share line. «Поділитися» opens the share sheet with the share line and
 * the grid in squares, then says «Скопійовано. Жодної літери — тільки клини.»;
 * «До ігор» goes to the Games hub.
 */
function CrossingCrosswordSolved({
  crossword,
  solve,
  withTime,
}: {
  crossword: CrossingCrosswordPlay;
  solve: CrosswordSolve;
  withTime: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useUndoToast();
  const texts = strings.dailyCrossword;
  const share = crosswordShare(crossword, solve, texts, withTime);
  return (
    <View
      testID="daily-crossword-screen"
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <CrosswordSolvedPoster
        time={share.time}
        grid={share.grid}
        share={share}
        onShare={() => {
          Share.share({ message: share.message }).then(
            ({ action }) => {
              if (action === Share.sharedAction)
                toast({ message: texts.share.copied, brief: true });
            },
            (error: unknown) => {
              logError('Could not share the Daily Crossword', error);
            },
          );
        }}
        onToGames={() => {
          router.dismissTo('/game');
        }}
        mascot={<MascotAs state="celebrates" onRed />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: space[4], paddingTop: space[2] },
  // Board 08's spacing; the grid shrinks when the clue bar and the Letter Wheel need its room.
  crossing: { paddingHorizontal: space[4], paddingBottom: space[2] },
  crossingSolved: { marginTop: space[4] },
  solved: { textAlign: 'center' },
  fill: { flexGrow: 1 },
  // As tall as the screen and no taller, so the grid gives up the room the rest needs.
  fit: { flex: 1 },
});
