import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { dashboard, feedHeader, fontScaleCap, space, typeStyle, wedges } from '../tokens';

/**
 * The Feed's header, from the design: the red wedge and the app's name
 * (`wordmark`, the Latin one, not the splash's) at the
 * start, today and the Streak pill (`streak`) at the end. VoiceOver reads the
 * wordmark as the screen's header. The Dashboard's header (`logo` `plate`)
 * sets the name in the background colour on a slanted ink plate instead.
 * Given `onLogo`, the logo is also a button VoiceOver reads by its label: the
 * Feed's leads to the Dashboard (ADR 0079), the Dashboard's plays the daily
 * splash (ADR 0105).
 */
export function FeedHeader({
  wordmark,
  today,
  streak,
  logo = 'wedge',
  onLogo,
}: {
  wordmark: string;
  today: string;
  streak: ReactNode;
  /** The red wedge before the name, as the Feed's, or the ink plate under it, as the Dashboard's. */
  logo?: 'wedge' | 'plate';
  /** What a tap on the logo does, and how VoiceOver names it; none, a plain header. */
  onLogo?: { label: string; onPress: () => void } | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const mark =
    logo === 'wedge' ? (
      <>
        <Wedge
          points={wedges.logo}
          color={colors.accent}
          width={feedHeader.logoWedge.width}
          height={feedHeader.logoWedge.height}
        />
        <Text
          maxFontSizeMultiplier={fontScaleCap.number}
          style={[typeStyle('logo', tokens), { color: colors.ink }]}
        >
          {wordmark}
        </Text>
      </>
    ) : (
      <View style={styles.plate}>
        <View style={StyleSheet.absoluteFill}>
          <Wedge points={wedges.logoPlate} color={colors.ink} width="100%" height="100%" />
        </View>
        <Text
          maxFontSizeMultiplier={fontScaleCap.number}
          style={[typeStyle('logo', tokens), { color: colors.background }]}
        >
          {wordmark}
        </Text>
      </View>
    );
  return (
    <View style={styles.row}>
      {onLogo === undefined ? (
        <View
          testID="feed-logo"
          accessible
          accessibilityRole="header"
          accessibilityLabel={wordmark}
          style={styles.logo}
        >
          {mark}
        </View>
      ) : (
        <View>
          {/* The title stays a heading apart from the button over the same mark. */}
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel={wordmark}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            testID="feed-logo"
            accessibilityRole="button"
            accessibilityLabel={onLogo.label}
            {...voice}
            onPress={onLogo.onPress}
            // The wordmark is shorter than a touch target; the tap area grows to it.
            hitSlop={space[2]}
            style={styles.logo}
          >
            {mark}
          </Pressable>
        </View>
      )}
      <View style={styles.end}>
        <Text
          testID="feed-today"
          maxFontSizeMultiplier={fontScaleCap.number}
          style={[typeStyle('headerDate', tokens), { color: colors.muted }]}
        >
          {today}
        </Text>
        {streak}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { flexDirection: 'row', alignItems: 'center', gap: feedHeader.logoGap },
  plate: {
    paddingTop: dashboard.logoPlate.top,
    paddingRight: dashboard.logoPlate.right,
    paddingBottom: dashboard.logoPlate.bottom,
    paddingLeft: dashboard.logoPlate.left,
  },
  end: { flexDirection: 'row', alignItems: 'center', gap: feedHeader.endGap },
});
