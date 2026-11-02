import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { minTouchTarget, space, typeRoles, typeSize } from '../tokens';

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
  const { colors, fontFamilies } = useTokens();
  const { strings, voice } = useEdition();
  return (
    <View testID="search-recent">
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          {...voice}
          style={[styles.eyebrow, { color: colors.muted, fontFamily: fontFamilies.word }]}
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
          <Text style={[styles.clearText, { color: colors.accent, fontFamily: fontFamilies.ui }]}>
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
          <Text style={[styles.query, { color: colors.ink, fontFamily: fontFamilies.ui }]}>
            {query}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const { eyebrow } = typeRoles;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: space[3],
  },
  eyebrow: {
    flexShrink: 1,
    fontSize: eyebrow.size,
    fontWeight: eyebrow.weight,
    lineHeight: eyebrow.lineHeight,
    letterSpacing: eyebrow.letterSpacing,
    textTransform: eyebrow.textTransform,
  },
  clear: {
    minHeight: minTouchTarget,
    minWidth: minTouchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  clearText: { fontSize: typeSize.body, fontWeight: '600' },
  row: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    paddingVertical: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  query: { fontSize: typeSize.recentQuery, fontWeight: '600' },
});
