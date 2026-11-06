import { View } from 'react-native';

import type { Wedge as WedgePoints } from '../tokens';
import { Wedge } from './Wedge';

/** One shape of a tile's pictogram: a polygon in fractions of its box, or a circle. */
export type TileShapeKind = WedgePoints | 'circle';

/** Where a shape sits on its tile: its side, from the right and from the top. */
/** A tile's pair of shapes, its big one and its small one. */
export type TileShapePair = readonly [TileShapeKind, TileShapeKind];

/** The shape pair of the tile at `index`: the board's pairs in turn, wrapping past the set. */
export function shapeAt(shapes: readonly TileShapePair[], index: number): TileShapePair {
  return shapes[index % shapes.length] ?? ['circle', 'circle'];
}

export interface TileShapePlace {
  readonly side: number;
  readonly right: number;
  readonly top: number;
}

/**
 * One shape of a tile's pictogram, a polygon or a circle, at its place: the
 * Category tiles and the Curated Collection tiles draw theirs with it.
 */
export function TileShape({
  shape,
  color,
  place: { side, right, top },
}: {
  shape: TileShapeKind;
  color: string;
  place: TileShapePlace;
}) {
  const at = { position: 'absolute', right, top } as const;
  return shape === 'circle' ? (
    <View
      style={[at, { width: side, height: side, borderRadius: side / 2, backgroundColor: color }]}
    />
  ) : (
    <Wedge points={shape} color={color} width={side} height={side} style={at} />
  );
}
