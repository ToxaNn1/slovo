import { useId } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Chip } from '../primitives/Chip';
import { useTokens } from '../providers/TokensProvider';
import { savedHeader, space } from '../tokens';

/** A tab of the Saved screen: a list, its count and how VoiceOver reads them. */
export interface SavedTab<Id extends string> {
  id: Id;
  label: string;
  count: number;
  accessibilityLabel: string;
}

/**
 * The Saved screen's tabs in a row that scrolls across: a chip per list with
 * its count, the active one filled ink. The row fades out into the
 * background at its right edge, so a tab past it reads as more to scroll to.
 * A tap on a tab asks to show its list.
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
  /** The row's test ID is `${testID}-row`, each tab's `${testID}-${id}`, the fade's `${testID}-fade`. */
  testID: string;
}) {
  const { colors } = useTokens();
  const gradient = useId();
  return (
    <View style={styles.frame}>
      <ScrollView
        testID={`${testID}-row`}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}
      >
        {tabs.map((tab) => (
          <Chip
            key={tab.id}
            testID={`${testID}-${tab.id}`}
            label={tab.label}
            count={tab.count}
            accessibilityLabel={tab.accessibilityLabel}
            on={tab.id === active}
            onPress={() => {
              onSelect(tab.id);
            }}
          />
        ))}
      </ScrollView>
      <Svg testID={`${testID}-fade`} pointerEvents="none" style={styles.fade}>
        <Defs>
          <LinearGradient id={gradient} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradient})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { marginHorizontal: space[5] },
  // A ScrollView grows by default: without this the row would split the
  // screen's height with the list under it.
  scroll: { flexGrow: 0 },
  row: { gap: space[2] },
  fade: { position: 'absolute', top: 0, bottom: 0, right: 0, width: savedHeader.fade },
});
