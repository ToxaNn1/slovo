import type { CorrectionType } from '@slovo/contracts';
import type { CorrectionTypeTile as CorrectionTypeTileModel } from '@slovo/core';
import { StyleSheet, View } from 'react-native';

import { CorrectionTypeTile } from '../dashboard/CorrectionTypeTile';
import { categoryGrid as place } from '../tokens';
import { GridTitle } from './CategoryGrid';

/**
 * The grid of the Correction Types: the title with the number of
 * them over two columns of the Dashboard rail's tiles, in the rail's order,
 * so the grid its header opens shows what the rail shows. A tile opens its
 * type's screen. It spans the screen's width, as a list's header does.
 */
export function CorrectionTypeGrid({
  title,
  tiles,
  onOpen,
  testID,
}: {
  title: string;
  tiles: readonly CorrectionTypeTileModel[];
  onOpen: (type: CorrectionType) => void;
  testID: string;
}) {
  return (
    <View testID={testID} style={styles.grid}>
      <GridTitle testID={`${testID}-title`} title={title} count={String(tiles.length)} />
      <View style={styles.tiles}>
        {tiles.map(({ type }, index) => (
          <View key={type} style={styles.cell}>
            <CorrectionTypeTile
              testID={`${testID}-${type}`}
              type={type}
              index={index}
              onOpen={onOpen}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: place.padding.side - place.gap / 2,
    paddingBottom: place.titleGap,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', padding: place.gap / 2 },
});
