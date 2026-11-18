import type { WidgetSnapshot } from '@slovo/contracts';
import type { Composition } from '@slovo/core';
import {
  BackHeader,
  space,
  typeStyle,
  useEdition,
  useTokens,
  WidgetGuideSteps,
  WidgetPreviews,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCompositionRead } from '@/composition';
import { editionStrings } from '@/edition/edition';
import { useEditionInEffect } from '@/edition/remote-switches';

const { allEntries, guide } = editionStrings.widget;
const strings = editionStrings.settings.widgets;

/** Reads the Widget Snapshot the widget would show now. */
const readSnapshot = ({ widget }: Composition) => widget.snapshot(editionStrings.notificationBody);

/**
 * The Word the previews draw: the first of «Усі слова» in the Widget
 * Snapshot, or the guide's sample while the snapshot reads or has none.
 */
function previewWordOf(snapshot: WidgetSnapshot | undefined) {
  const first = snapshot?.entries.find(({ id }) => id === snapshot.allEntries[0]);
  return first === undefined
    ? guide.sample
    : { lemma: first.headline, definition: first.secondLine };
}

/**
 * Settings › «Віджети»: what each widget looks like, drawn from the Widget
 * Snapshot, over the three steps to add one (ADR 0054). The previews are
 * only a look and keep nothing (ADR 0026); the lock-screen one is there
 * while the snapshot carries the lock-screen widget. With the widget
 * previews off, the steps alone.
 */
export default function WidgetsScreen() {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const router = useRouter();
  const previewsOn = useEditionInEffect().isFeatureEnabled('widgetPreviews');
  const read = useCompositionRead(readSnapshot, 'widget previews');
  const snapshot = read.status === 'ready' ? read.value : undefined;
  return (
    <SafeAreaView
      testID="widget-guide"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      {/* The title beside the back tile, as on every screen a Settings row opens (owner 08.11). */}
      <View style={styles.bar}>
        <BackHeader
          titleRole="settingsSubTitle"
          title={strings.title}
          back={{
            label: editionStrings.settings.title,
            testID: 'widget-guide-back',
            onPress: () => {
              router.back();
            },
          }}
        />
      </View>
      <ScrollView testID="widgets-scroll" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text {...voice} style={[typeStyle('sub', tokens), { color: colors.muted }]}>
            {strings.subtitle}
          </Text>
        </View>
        {previewsOn && (
          <WidgetPreviews
            testID="widget-previews"
            accessibilityLabel={strings.title}
            names={strings.previews}
            lockScreen={snapshot?.lockScreenWidget === true}
            mode={allEntries}
            {...previewWordOf(snapshot)}
          />
        )}
        <WidgetGuideSteps testID="widget-guide" steps={guide.steps} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The back header stays above the list, so the list scrolls under it, not the header under the status bar.
  bar: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[2] },
  content: { paddingHorizontal: space[5], paddingBottom: space[8] },
  header: { paddingBottom: space[4] },
});
