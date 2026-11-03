import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Wedge } from '../primitives/Wedge';
import { useTokens } from '../providers/TokensProvider';
import { feedHeader, typeStyle, wedges } from '../tokens';

/** How far the largest text sizes of iOS may scale the header's text, so it stays on one row. */
const HEADER_MAX_FONT_SCALE = 1.3;

/**
 * The Feed's header, from the design: the red wedge and the app's name
 * (`wordmark`, the Latin one, not the splash's) at the
 * start, today and the Streak pill (`streak`) at the end. VoiceOver reads the
 * wordmark as the screen's header.
 */
export function FeedHeader({
  wordmark,
  today,
  streak,
}: {
  wordmark: string;
  today: string;
  streak: ReactNode;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  return (
    <View style={styles.row}>
      <View
        testID="feed-logo"
        accessible
        accessibilityRole="header"
        accessibilityLabel={wordmark}
        style={styles.logo}
      >
        <Wedge
          points={wedges.logo}
          color={colors.accent}
          width={feedHeader.logoWedge.width}
          height={feedHeader.logoWedge.height}
        />
        <Text
          maxFontSizeMultiplier={HEADER_MAX_FONT_SCALE}
          style={[typeStyle('logo', tokens), { color: colors.ink }]}
        >
          {wordmark}
        </Text>
      </View>
      <View style={styles.end}>
        <Text
          testID="feed-today"
          maxFontSizeMultiplier={HEADER_MAX_FONT_SCALE}
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
  end: { flexDirection: 'row', alignItems: 'center', gap: feedHeader.endGap },
});
