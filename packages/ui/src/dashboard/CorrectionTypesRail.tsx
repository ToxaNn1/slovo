import type { CorrectionType } from '@slovo/contracts';
import type { CorrectionTypeTile as CorrectionTypeTileModel } from '@slovo/core';
import { ScrollView, StyleSheet } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { correctionTile, dashboard } from '../tokens';
import { CorrectionTypeTile } from './CorrectionTypeTile';
import { RailHeader } from './RailHeader';

/**
 * The Correction Types rail of the Dashboard: «Виправлення» with
 * the count of tiles over a horizontal row that runs to the screen's edges,
 * one tile per Correction Type with live Corrections. A tile opens its
 * type's screen. Given a `grid`, the header reads its count instead and is
 * a button that opens it: the Categories of Corrections, k2 (spec #1604),
 * or with `correctionTypeGrid` the same tiles with k2 under them; without, a plain title.
 */
export function CorrectionTypesRail({
  tiles,
  grid,
  onOpen,
}: {
  tiles: readonly CorrectionTypeTileModel[];
  /** The count the header reads and the opener of the grid it opens. */
  grid?: { readonly count: number; readonly onOpenAll: () => void } | undefined;
  onOpen: (type: CorrectionType) => void;
}) {
  const { strings } = useEdition();
  return (
    <>
      <RailHeader
        testID="dashboard-correction-types-title"
        title={strings.dashboard.correctionTypes.title}
        note={String(grid?.count ?? tiles.length)}
        onPress={grid?.onOpenAll}
      />
      <ScrollView
        testID="dashboard-correction-types"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        {tiles.map(({ type }, index) => (
          <CorrectionTypeTile
            key={type}
            testID={`dashboard-correction-type-${type}`}
            type={type}
            index={index}
            width={correctionTile.width}
            onOpen={onOpen}
          />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  rail: {
    gap: correctionTile.gap,
    paddingHorizontal: dashboard.side,
    paddingBottom: dashboard.railBottom,
  },
});
