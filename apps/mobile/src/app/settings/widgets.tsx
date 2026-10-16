import { BackLink, GuideStep, ScreenTitle, space, useTokens, WidgetDrawing } from '@slovo/ui';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '../../edition/edition';

const { allEntries, guide } = editionStrings.widget;

/**
 * Settings › «Віджети: як додати»: how to put the widget on the home screen,
 * in three steps, over a drawing of the small and the medium widget.
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
        <BackLink
          testID="widget-guide-back"
          label={editionStrings.settings.title}
          onPress={() => {
            router.back();
          }}
        />
        <View style={styles.title}>
          <ScreenTitle>{guide.title}</ScreenTitle>
        </View>
        <WidgetDrawing
          testID="widget-guide-drawing"
          caption={guide.sizes}
          mode={allEntries}
          {...guide.sample}
        />
        <View style={styles.steps}>
          {guide.steps.map((step, index) => (
            <GuideStep
              key={index}
              testID={`widget-guide-step-${String(index + 1)}`}
              number={index + 1}
              title={step.title}
              hint={step.hint}
              last={index === guide.steps.length - 1}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  title: { paddingTop: space[2], paddingBottom: space[4] },
  steps: { marginTop: space[4] },
});
