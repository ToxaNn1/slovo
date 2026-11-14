import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { minTouchTarget, recentQueryDrawing, space, typeStyle } from '../tokens';

/**
 * The recent queries of Search, under its empty field and its «Нещодавно»
 * label (board 09, screen 78): one row a query, newest first, each after a
 * muted clock. A tap on a query runs it again.
 */
export function RecentQueries({
  queries,
  onRun,
}: {
  queries: readonly string[];
  onRun: (query: string) => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return queries.map((query, index) => (
    <Pressable
      key={query}
      testID={`search-recent-${String(index)}`}
      accessibilityRole="button"
      accessibilityLabel={query}
      {...voice}
      onPress={() => {
        onRun(query);
      }}
      style={styles.row}
    >
      <Clock color={colors.muted} />
      <Text style={[typeStyle('recentQuery', tokens), styles.query, { color: colors.ink }]}>
        {query}
      </Text>
    </Pressable>
  ));
}

function Clock({ color }: { color: string }) {
  return (
    <Svg
      width={recentQueryDrawing.clock}
      height={recentQueryDrawing.clock}
      viewBox="0 0 14 14"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle cx={7} cy={7} r={5.5} fill="none" stroke={color} strokeWidth={2} />
      <Polygon points="6,3 8,3 8,7 10,9 9,10 6,7.5" fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space[3],
    paddingVertical: recentQueryDrawing.paddingVertical,
  },
  query: { flexShrink: 1 },
});
