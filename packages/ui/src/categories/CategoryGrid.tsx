'use no memo';
// Reanimated code: the React Compiler skips this module (ADR 0059).

import type { ReactElement, ReactNode } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useCascade } from '../primitives/useCascade';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { categoryGrid as place, typeStyle } from '../tokens';
import {
  CategoryTile,
  shapeAt,
  toneByPosition,
  type CategoryShapes,
  type CategoryTileBox,
  type CategoryTone,
} from './CategoryTile';

/** One tile of a grid: what it opens and the name it shows. */
export interface GridTile {
  readonly id: string;
  readonly name: string;
  /** What VoiceOver reads for the tile, when it is more than its name. */
  readonly accessibilityLabel?: string;
}

/**
 * A full-screen grid of tiles (board 05.2): the title with its count on one
 * baseline, then the tiles in `columns` columns, each in the tone `toneAt`
 * gives its position and the shape pair at its position, wrapping past the
 * set. The tiles cascade in one after another; under Reduce Motion they only
 * fade in (ADR 0055). A tile opens its id. A `header` goes over the title,
 * across the whole width from the top, as a list's header would, and `empty`
 * shows in place of the tiles while there are none.
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
  header,
  empty,
  onOpen,
  testID,
}: {
  title: string;
  count: string;
  tiles: readonly GridTile[];
  columns: GridColumns;
  /** The tile's box; its width is the column's. */
  box: Omit<CategoryTileBox, 'width'>;
  shapes: readonly CategoryShapes[];
  toneAt?: (index: number) => CategoryTone;
  /** How long after the one before a tile starts to rise in, in ms. */
  stagger?: number;
  /** What goes over the title, such as the screen's back link and its tool. */
  header?: ReactElement;
  /** What shows while there are no tiles. */
  empty?: ReactElement | null;
  onOpen: (id: string) => void;
  testID: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const width = columnWidth[columns];
  return (
    <FlatList<GridTile>
      testID={testID}
      data={tiles}
      keyExtractor={({ id }) => id}
      numColumns={columns}
      initialNumToRender={tiles.length}
      key={columns}
      ListHeaderComponent={
        <>
          {header !== undefined && <View style={styles.header}>{header}</View>}
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
        </>
      }
      ListEmptyComponent={empty}
      // A header may hold a text field and its submit: a tap lands on the first
      // try, and the header moves over the keyboard.
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      renderItem={({ item: { id, name, accessibilityLabel }, index }) => (
        <Cascade testID={`${testID}-${id}-cascade`} index={index} stagger={stagger} width={width}>
          <CategoryTile
            testID={`${testID}-${id}`}
            name={name}
            accessibilityLabel={accessibilityLabel ?? name}
            tone={toneAt(index)}
            shapes={shapeAt(shapes, index)}
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

/** A column's share of the grid's width, by the number of columns. */
const columnWidth = { 2: '50%', 3: '33.3333%', 4: '25%' } as const;

/** How many columns a grid of Category tiles takes. */
export type GridColumns = keyof typeof columnWidth;

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
  width: `${number}%`;
  testID: string;
  children: ReactNode;
}) {
  const shown = useCascade(index, {
    variant: 'rise',
    stagger,
    duration: place.cascade.duration,
  });
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
  // Out of the grid's own padding: a header spans the screen as over a list.
  header: {
    marginTop: -place.padding.top,
    marginHorizontal: -(place.padding.side - place.gap / 2),
    paddingBottom: place.titleGap,
  },
});
