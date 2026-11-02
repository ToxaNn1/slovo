import { DecorBackground, FeedLoading, space, useTokens } from '@slovo/ui';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { editionStrings } from './edition';

/**
 * The Feed's header over the cards: the design's row of the logo, today and
 * the Streak pill (32), a gap (8), and the row of the XP bar, Search and Mood (40).
 */
export const TOP_ROW = 80;

const { feed: feedStrings } = editionStrings;

/** The Feed's loading state on its own screen: the `mascot` over the skeleton card, the divider being stitched. */
export function FeedLoadingScreen({ mascot }: { mascot?: ReactNode }) {
  const { colors } = useTokens();
  const { top } = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <DecorBackground />
      <View style={[styles.content, { paddingTop: top + TOP_ROW }]}>
        <FeedLoading
          text={feedStrings.loading}
          accessibilityLabel={feedStrings.loadingLabel}
          mascot={mascot}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[6], paddingBottom: space[6] },
});
