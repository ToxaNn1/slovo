import { correctionGrid, correctionGridBox } from '../tokens';
import { CategoryGrid, type GridTile } from './CategoryGrid';
import type { CategoryTone } from './CategoryTile';

/** k2's tones: the first tile red, the others the sunken surface (board 05.2). */
function firstRed(index: number): CategoryTone {
  return index === 0 ? 'red' : 'tile';
}

/**
 * k2, the grid of the Categories of Corrections (board 05.2): the title with
 * the number of them, two columns of tall tiles, the first red and the others
 * the sunken surface, cascading in 40 ms apart. A tile opens its Category.
 */
export function CorrectionCategoryGrid({
  title,
  tiles,
  onOpen,
  testID,
}: {
  title: string;
  tiles: readonly GridTile[];
  onOpen: (id: string) => void;
  testID: string;
}) {
  return (
    <CategoryGrid
      testID={testID}
      title={title}
      count={String(tiles.length)}
      tiles={tiles}
      columns={2}
      box={correctionGridBox}
      shapes={correctionGrid.shapes}
      toneAt={firstRed}
      stagger={correctionGrid.stagger}
      onOpen={onOpen}
    />
  );
}
