import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { minTouchTarget, space, typeStyle } from '../tokens';

/**
 * The recent queries of Search, under its empty field: «Нещодавно» in small
 * capitals with «Очистити» on the right, then one row a query, newest first. A tap on a query runs it again.
 */
export function RecentQueries({
  queries,
  onRun,
  onClear,
}: {
  queries: readonly string[];
  onRun: (query: string) => void;
  onClear: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  return (
    <View testID="search-recent">
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          {...voice}
          style={[typeStyle('eyebrow', tokens), styles.eyebrow, { color: colors.muted }]}
        >
          {strings.search.recent}
        </Text>
        <Pressable
          testID="search-recent-clear"
          accessibilityRole="button"
          accessibilityLabel={strings.search.clear}
          {...voice}
          onPress={onClear}
          style={styles.clear}
        >
          <Text style={[typeStyle('recentClear', tokens), { color: colors.accent }]}>
            {strings.search.clear}
          </Text>
        </Pressable>
      </View>
      {queries.map((query, index) => (
        <Pressable
          key={query}
          testID={`search-recent-${String(index)}`}
          accessibilityRole="button"
          accessibilityLabel={query}
          {...voice}
          onPress={() => {
            onRun(query);
          }}
          style={[styles.row, { borderBottomColor: colors.line }]}
        >
          <Text style={[typeStyle('recentQuery', tokens), { color: colors.ink }]}>{query}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: space[3],
  },
  eyebrow: { flexShrink: 1 },
  clear: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  row: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingVertical: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
