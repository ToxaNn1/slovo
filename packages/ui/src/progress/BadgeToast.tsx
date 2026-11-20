'use no memo';
// Reanimated code: the React Compiler skips this module.
import type { BadgeShape, BadgeTone } from '@slovo/contracts';
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { badgeToast, typeStyle } from '../tokens';
import { BadgeMark } from './BadgeMark';
import { REDUCED_FADE } from '../primitives/timing';

/**
 * A Badge earned during a Game (board 10.7): a toast on the
 * Theme's ink over the bottom of the screen with the Badge's mark, its name
 * and the line, instead of the stamp, so the Game goes on. In the dark Theme
 * it inverts to cream with dark words (decision 22). It takes no touch, and
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
  const { colors } = tokens;
  const window = useWindowDimensions();
  const width = Math.min(badgeToast.width, window.width - 2 * badgeToast.horizontal);
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
      style={[styles.toast, { width, backgroundColor: colors.ink }, faded]}
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
        <Text
          {...voice}
          style={[typeStyle('badgeToastName', tokens), { color: colors.background }]}
        >
          {name}
        </Text>
        <Text
          {...voice}
          style={[typeStyle('badgeToastLine', tokens), styles.line, { color: colors.background }]}
        >
          {line}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: badgeToast.bottom,
    flexDirection: 'row',
    alignItems: 'center',
    gap: badgeToast.gap,
    padding: badgeToast.padding,
    borderRadius: badgeToast.radius,
    boxShadow: badgeToast.shadow,
  },
  texts: { flex: 1 },
  line: { marginTop: badgeToast.linesGap, opacity: badgeToast.lineOpacity },
});
