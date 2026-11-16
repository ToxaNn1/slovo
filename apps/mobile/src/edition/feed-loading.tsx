import { FeedLoading, feedLoading, useTokens } from '@slovo/ui';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { editionStrings } from './edition';

/**
 * The Feed's header over the cards: the design's row of the logo, today and
 * the Streak pill (32), a gap (8), and the row of the XP bar and Search (40).
 */
export const TOP_ROW = 80;

/**
 * The Feed's header over the tabbed cards with nothing under the logo row
 * (board p1, ADR 0091): the room above the row (8), the row (32) and the
 * room under it (14), where the first card starts.
 */
export const LOGO_ROW = 54;

const { feed: feedStrings } = editionStrings;

/** The Feed's loading state on its own screen (board XSettings m5): the card placeholder under the status bar. */
export function FeedLoadingScreen() {
  const { colors } = useTokens();
  const { top } = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { paddingTop: top + feedLoading.top }]}>
        <FeedLoading accessibilityLabel={feedStrings.loadingLabel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: feedLoading.side },
});
