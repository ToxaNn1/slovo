'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Polygon } from 'react-native-svg';

import { useCascade } from '../primitives/useCascade';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { minTouchTarget, recentQueryDrawing, space, typeStyle } from '../tokens';

/**
 * The recent queries of Search, under its empty field and its «Нещодавно»
 * label (board 09, screen 78): one row a query, newest first, each after a
 * muted clock, rising in one after another. A tap on a query runs it again.
 */
export function RecentQueries({
  queries,
  onRun,
}: {
  queries: readonly string[];
  onRun: (query: string) => void;
}) {
  return queries.map((query, index) => (
    <RecentQuery
      key={query}
      query={query}
      index={index}
      onRun={() => {
        onRun(query);
      }}
    />
  ));
}

function RecentQuery({ query, index, onRun }: { query: string; index: number; onRun: () => void }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const entered = useCascade(index, recentQueryDrawing.cascade);
  const testID = `search-recent-${String(index)}`;
  return (
    <Animated.View testID={`${testID}-cascade`} style={entered}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={query}
        {...voice}
        onPress={onRun}
        style={styles.row}
      >
        <Clock color={colors.muted} />
        <Text style={[typeStyle('recentQuery', tokens), styles.query, { color: colors.ink }]}>
          {query}
        </Text>
      </Pressable>
    </Animated.View>
  );
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
