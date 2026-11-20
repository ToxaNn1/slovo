import { FeedLoading, feedLoading, useTokens } from '@slovo/ui';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { editionStrings } from './edition';

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
