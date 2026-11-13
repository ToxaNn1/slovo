'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).
import type { BadgeShape, BadgeTone } from '@slovo/contracts';
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { badgeToast, typeStyle } from '../tokens';
import { BadgeMark } from './BadgeMark';
import { REDUCED_FADE } from '../primitives/timing';

/**
 * A Badge earned during a Game (board 10.7, `badgeToast` on): an ink toast
 * over the bottom of the screen with the Badge's mark, its name and the
 * line, instead of the stamp, so the Game goes on. It takes no touch, and
 * tells VoiceOver the name and the line once. Whoever draws it takes it away.
 */
export function BadgeToast({
  shape,
  tone,
  symbol,
  name,
  line,
  testID = 'badge-toast',
}: {
  /** The shape of the Badge's family. */
  shape: BadgeShape;
  /** The tone of the Badge's family. */
  tone: BadgeTone;
  symbol: string;
  name: string;
  /** The line under the name, e.g. «Нова відзнака — тепер вона твоя назавжди.». */
  line: string;
  testID?: string;
}) {
  const tokens = useTokens();
  const { voice } = useEdition();
  // The ink toast carries the light Theme's ink and cream, in both Themes.
  const key = useSchemeColors('light');
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = withTiming(1, REDUCED_FADE);
    AccessibilityInfo.announceForAccessibility(`${name}. ${line}`);
  }, [shown, name, line]);
  const faded = useAnimatedStyle(() => ({ opacity: shown.value }));

  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.toast, { backgroundColor: key.ink }, faded]}
    >
      <BadgeMark
        testID={`${testID}-mark`}
        shape={shape}
        tone={tone}
        symbol={symbol}
        state={{ kind: 'earned', isNew: false }}
        size={badgeToast.markSide}
      />
      <View style={styles.texts}>
        <Text {...voice} style={[typeStyle('sectionLabel', tokens), { color: key.background }]}>
          {name}
        </Text>
        <Text {...voice} style={[typeStyle('profileText', tokens), { color: key.background }]}>
          {line}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: badgeToast.horizontal,
    right: badgeToast.horizontal,
    bottom: badgeToast.bottom,
    flexDirection: 'row',
    alignItems: 'center',
    gap: badgeToast.gap,
    padding: badgeToast.padding,
    borderRadius: badgeToast.radius,
  },
  texts: { flex: 1 },
});
