'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import { useEffect, type ReactNode } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useEdition } from '../providers/EditionProvider';
import { useReduceMotion } from '../providers/useReduceMotion';
import { useTokens } from '../providers/TokensProvider';
import { categoryGrid as place, motion, typeStyle } from '../tokens';
import {
  CategoryTile,
  toneByPosition,
  type CategoryShape,
  type CategoryTileBox,
  type CategoryTone,
} from './CategoryTile';

const cascadeEasing = Easing.bezier(...motion.cascade.easing);
const fadeEasing = Easing.bezier(...motion.reduceMotion.easing);

/** One tile of a grid: what it opens and the name it shows. */
export interface GridTile {
  readonly id: string;
  readonly name: string;
}

/**
 * A full-screen grid of tiles (board 05.2): the title with its count on one
 * baseline, then the tiles in `columns` columns, each in the tone `toneAt`
 * gives its position and the shape pair at its position, wrapping past the
 * set. The tiles cascade in one after another; under Reduce Motion they only
 * fade in (ADR 0055). A tile opens its id.
 */
export function CategoryGrid({
  title,
  count,
  tiles,
  columns,
  box,
  shapes,
  toneAt = toneByPosition,
  stagger = place.cascade.stagger,
  onOpen,
  testID,
}: {
  title: string;
  count: string;
  tiles: readonly GridTile[];
  columns: number;
  /** The tile's box; its width is the column's. */
  box: Omit<CategoryTileBox, 'width'>;
  shapes: readonly (readonly [CategoryShape, CategoryShape])[];
  toneAt?: (index: number) => CategoryTone;
  /** How long after the one before a tile starts to rise in, in ms. */
  stagger?: number;
  onOpen: (id: string) => void;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const width = `${String(100 / columns)}%` as const;
  return (
    <FlatList<GridTile>
      testID={testID}
      data={tiles}
      keyExtractor={({ id }) => id}
      numColumns={columns}
      initialNumToRender={tiles.length}
      key={columns}
      ListHeaderComponent={
        <View
          testID={`${testID}-title`}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${title}, ${count}`}
          accessibilityLanguage={voice.accessibilityLanguage}
          style={styles.title}
        >
          <Text {...voice} style={[typeStyle('gridTitle', tokens), { color: colors.ink }]}>
            {title}
          </Text>
          <Text {...voice} style={[typeStyle('gridCount', tokens), { color: colors.muted }]}>
            {count}
          </Text>
        </View>
      }
      renderItem={({ item: { id, name }, index }) => (
        <Cascade testID={`${testID}-${id}-cascade`} index={index} stagger={stagger} width={width}>
          <CategoryTile
            testID={`${testID}-${id}`}
            name={name}
            tone={toneAt(index)}
            shapes={shapes[index % shapes.length] ?? ['circle', 'circle']}
            box={box}
            onPress={() => {
              onOpen(id);
            }}
          />
        </Cascade>
      )}
      contentContainerStyle={styles.content}
      style={{ backgroundColor: colors.background }}
    />
  );
}

/** A tile's entrance: it rises in after `index` tiles, or under Reduce Motion fades in at once. */
function Cascade({
  index,
  stagger,
  width,
  testID,
  children,
}: {
  index: number;
  stagger: number;
  width: `${string}%`;
  testID: string;
  children: ReactNode;
}) {
  const reduceMotion = useReduceMotion();
  // 1 once the tile has entered.
  const entered = useSharedValue(0);
  useEffect(() => {
    entered.value = reduceMotion
      ? withTiming(1, {
          duration: motion.reduceMotion.duration,
          easing: fadeEasing,
          reduceMotion: ReduceMotion.Never,
        })
      : withDelay(
          index * stagger,
          withTiming(1, {
            duration: place.cascade.duration,
            easing: cascadeEasing,
            reduceMotion: ReduceMotion.Never,
          }),
          ReduceMotion.Never,
        );
  }, [entered, index, stagger, reduceMotion]);
  const shown = useAnimatedStyle(() => ({
    opacity: entered.value,
    transform: [{ translateY: reduceMotion ? 0 : (1 - entered.value) * motion.cascade.rise }],
  }));
  return (
    <Animated.View testID={testID} style={[styles.cell, { width }, shown]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: place.padding.top,
    paddingHorizontal: place.padding.side - place.gap / 2,
    paddingBottom: place.padding.bottom,
  },
  title: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: place.gap,
    paddingHorizontal: place.gap / 2,
    paddingBottom: place.titleGap,
  },
  cell: { padding: place.gap / 2 },
});
