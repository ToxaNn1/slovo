import { BackHeader, space, useTokens, WidgetGuide } from '@slovo/ui';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';

const { allEntries, guide } = editionStrings.widget;

/**
 * Settings › Віджети › «Як додати віджет»: how to put the widget on the home
 * screen, in three steps, under a drawing of the small and the medium widget.
 */
export default function WidgetGuideScreen() {
  const { colors } = useTokens();
  const router = useRouter();
  return (
    <SafeAreaView
      testID="widget-guide"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* The title beside the back tile, as on every screen a Settings row opens (owner 08.11). */}
        <View style={styles.header}>
          <BackHeader
            titleRole="settingsSubTitle"
            title={guide.title}
            back={{
              label: editionStrings.settings.title,
              testID: 'widget-guide-back',
              onPress: () => {
                router.back();
              },
            }}
          />
        </View>
        <WidgetGuide
          testID="widget-guide"
          steps={guide.steps}
          caption={guide.sizes}
          mode={allEntries}
          {...guide.sample}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  header: { paddingBottom: space[4] },
});
