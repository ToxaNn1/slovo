import { StyleSheet } from 'react-native';
import Svg, { Defs, Rect } from 'react-native-svg';

import { HalftoneDots } from '../primitives/HalftoneDots';

/** The halftone raster over a red stamp screen; `id` names its pattern, unique on the screen. */
export function StampHalftone({ id }: { id: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <HalftoneDots id={id} />
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
