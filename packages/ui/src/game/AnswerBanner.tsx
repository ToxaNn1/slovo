'use no memo';
// Reanimated code: the React Compiler skips this module.

import type { CurrentGame } from '@slovo/core';
import { type ReactNode, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, useWindowDimensions } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wedge } from '../primitives/Wedge';
import { bezier } from '../primitives/timing';
import { fill, useEdition } from '../providers/EditionProvider';
import { InvertedTokens, SchemeTokens, useTokens } from '../providers/TokensProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { motion, roundLayout, space, typeStyle, wedges } from '../tokens';
import { NextButton, VerdictTitle } from './AnswerCard';

/** What the answer banner shows: the Core's answered state. */
export type AnsweredRound = Extract<CurrentGame, { status: 'answered' }>['answered'];

/** How long the banner waits at most for VoiceOver to finish reading it, in milliseconds. */
const ANNOUNCEMENT_LIMIT = 5000;

/**
 * The slanted banner after an answer (D1 of spec #1880): it slides
 * in from the bottom, the whole width, on the accent for a right answer with
 * the praise and the XP the answer earned, on the ink for a wrong one with
 * «МИМО», or «ЖИТТЯ ВСЕ» when it took the last Life, and the right answer.
 * The Game moves on by itself after its delay, or, when the Core gives none
 * (a wrong answer with no time limit), on the banner's «Далі →»,
 * which `onNext` names. With «Менше руху» it shows without
 * sliding. With VoiceOver on it is announced, and `onWaitFor` gets the
 * announcement, so the Game holds the Round until VoiceOver has read it.
 */
export function AnswerBanner({
  answered,
  praise,
  onWaitFor,
  onNext,
}: {
  answered: AnsweredRound;
  /** Which praise a right answer takes: the praises go in turn, one per right answer. */
  praise: number;
  /** Hands the Game what it waits for besides the banner's delay: VoiceOver reading the banner. */
  onWaitFor: (done: Promise<unknown>) => void;
  /** «Далі →» on the banner, for a Round that waits for it; left out, the Game moves on by itself. */
  onNext?: (() => void) | undefined;
}) {
  const { strings } = useEdition();
  const texts = strings.game.round.banner;
  const title =
    answered.kind === 'right'
      ? (texts.right[praise % texts.right.length] ?? '')
      : answered.lastLife
        ? texts.lastLife
        : texts.wrong;
  const line =
    answered.kind === 'right'
      ? answered.xp === undefined
        ? undefined
        : fill(texts.xp, { count: String(answered.xp) })
      : fill(texts.answer, { answer: answered.answer });
  const announcement = line === undefined ? title : `${title} ${line}`;

  // The banner announces itself once, as it shows; the screen keys it by its Round.
  const [shown] = useState(() => ({ announcement, onWaitFor }));
  useEffect(() => {
    // A check that fails counts as no screen reader, so the Round still moves on.
    shown.onWaitFor(
      AccessibilityInfo.isScreenReaderEnabled()
        .catch(() => false)
        .then((on) => (on ? announced(shown.announcement) : undefined)),
    );
  }, [shown]);

  const reduceMotion = useReduceMotion();
  const { height } = useWindowDimensions();
  const rise = useSharedValue(reduceMotion ? 0 : height);
  useEffect(() => {
    if (reduceMotion) {
      rise.value = 0;
      return;
    }
    rise.value = withTiming(0, {
      duration: motion.toast.duration,
      easing: bezier(motion.toast.easing),
      reduceMotion: ReduceMotion.Never,
    });
  }, [reduceMotion, rise]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: rise.value }] }));

  const [size, setSize] = useState<{ width: number; height: number } | undefined>(undefined);
  const insets = useSafeAreaInsets();
  const right = answered.kind === 'right';
  const { colors } = useTokens();
  const Scheme = right ? LightTokens : InvertedTokens;
  return (
    <Animated.View
      testID="game-answer-banner"
      pointerEvents={onNext === undefined ? 'none' : 'box-none'}
      // The slab is drawn at the banner's measured size: an SVG sized in percents comes out short on a phone.
      onLayout={(event) => {
        const { width, height: bannerHeight } = event.nativeEvent.layout;
        setSize({ width, height: bannerHeight });
      }}
      style={[styles.banner, { paddingBottom: Math.max(insets.bottom, space[8]) }, slide]}
    >
      {size === undefined ? null : (
        <Wedge
          points={wedges.answerBanner}
          color={right ? colors.accent : colors.ink}
          width={size.width}
          height={size.height}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Scheme>
        <VerdictTitle testID="game-answer-banner-title" typeRole="roundVerdict" text={title} />
        {line === undefined ? null : <BannerLine text={line} />}
        {onNext === undefined ? null : (
          <NextButton label={strings.game.round.answerCard.next} right={right} onPress={onNext} />
        )}
      </Scheme>
    </Animated.View>
  );
}

/** The light scheme's tokens, which the accent of a right answer carries in both Themes. */
function LightTokens({ children }: { children: ReactNode }) {
  return <SchemeTokens colorScheme="light">{children}</SchemeTokens>;
}

/** The banner's second line: the XP, or the right answer. */
function BannerLine({ text }: { text: string }) {
  const tokens = useTokens();
  const { voice } = useEdition();
  return (
    <Text
      testID="game-answer-banner-line"
      maxFontSizeMultiplier={roundLayout.textMaxFontScale}
      {...voice}
      style={[typeStyle('roundExplanation', tokens), { color: tokens.colors.ink }]}
    >
      {text}
    </Text>
  );
}

/**
 * Has VoiceOver read `text` after what it is reading, and settles once it has
 * finished reading `text`, not another announcement, or at the latest after
 * `ANNOUNCEMENT_LIMIT`. Only iOS tells when an announcement has finished;
 * elsewhere it settles at once.
 */
function announced(text: string): Promise<void> {
  if (Platform.OS !== 'ios') {
    AccessibilityInfo.announceForAccessibility(text);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const finished = AccessibilityInfo.addEventListener(
      'announcementFinished',
      ({ announcement }) => {
        if (announcement === text) done();
      },
    );
    const limit = setTimeout(done, ANNOUNCEMENT_LIMIT);
    function done() {
      finished.remove();
      clearTimeout(limit);
      resolve();
    }
    AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true });
  });
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: space[2],
    paddingTop: space[8] + space[4],
    paddingHorizontal: space[6],
  },
});
