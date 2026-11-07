import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '../primitives/Chip';
import { useTokens } from '../providers/TokensProvider';
import { space, tabBar } from '../tokens';

/** A tab of the Saved screen: a list, its count and how VoiceOver reads them. */
export interface SavedTab<Id extends string> {
  id: Id;
  label: string;
  count: number;
  accessibilityLabel: string;
}

/**
 * The Saved screen's tabs in a row that scrolls across: a chip per list with
 * its count, the active one filled ink with the red slanted bar of the tab
 * bar under it. A tap on a tab asks to show its list.
 */
export function SavedTabs<Id extends string>({
  tabs,
  active,
  onSelect,
  testID,
}: {
  tabs: readonly SavedTab<Id>[];
  active: Id;
  onSelect: (id: Id) => void;
  /** The row's test ID is `${testID}-row`, each tab's `${testID}-${id}`. */
  testID: string;
}) {
  const { colors } = useTokens();
  return (
    <ScrollView
      testID={`${testID}-row`}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {tabs.map((tab) => (
        <View key={tab.id} style={styles.tab}>
          <Chip
            testID={`${testID}-${tab.id}`}
            label={tab.label}
            count={tab.count}
            accessibilityLabel={tab.accessibilityLabel}
            on={tab.id === active}
            onPress={() => {
              onSelect(tab.id);
            }}
          />
          <View
            testID={tab.id === active ? `${testID}-indicator` : undefined}
            style={[styles.indicator, tab.id === active && { backgroundColor: colors.accent }]}
          />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: space[2],
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[2],
  },
  tab: { alignItems: 'center', gap: space[1] },
  indicator: {
    width: tabBar.indicator.width,
    height: tabBar.indicator.height,
    transform: [{ skewX: tabBar.indicator.skewX }],
  },
});
