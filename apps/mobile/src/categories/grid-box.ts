import { categoryGrid } from '@slovo/ui';

/** The box of a k1 grid tile (board 05.2), for the Categories and the Collections in their style. */
export const gridBox = {
  height: categoryGrid.height,
  radius: categoryGrid.radius,
  padding: categoryGrid.tilePadding,
  big: categoryGrid.big,
  small: categoryGrid.small,
  name: 'gridTileName',
} as const;
