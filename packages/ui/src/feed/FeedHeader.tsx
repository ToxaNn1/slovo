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
 * Given `onOpenDashboard`, the Feed's wordmark is a button to the Dashboard
 * (ADR 0079), which VoiceOver reads by `dashboard.open`.
 */
export function FeedHeader({
  wordmark,
  today,
  streak,
  logo = 'wedge',
  onOpenDashboard,
}: {
  wordmark: string;
  today: string;
  streak: ReactNode;
  /** The red wedge before the name, as the Feed's, or the ink plate under it, as the Dashboard's. */
  logo?: 'wedge' | 'plate';
  /** Opens the Dashboard from the wordmark; none where the header is the home's own. */
  onOpenDashboard?: (() => void) | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
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
      {onOpenDashboard === undefined ? (
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
        <Pressable
          testID="feed-logo"
          accessibilityRole="button"
          accessibilityLabel={strings.dashboard.open}
          {...voice}
          onPress={onOpenDashboard}
          // The wordmark is shorter than a touch target; the tap area grows to it.
          hitSlop={space[2]}
          style={styles.logo}
        >
          {mark}
        </Pressable>
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
