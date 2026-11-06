import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { halftone } from '../tokens';

/** The halftone raster over a red stamp screen; `id` names its pattern, unique on the screen. */
export function StampHalftone({ id }: { id: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id={id} width={halftone.cell} height={halftone.cell} patternUnits="userSpaceOnUse">
          <Circle
            cx={halftone.cell / 2}
            cy={halftone.cell / 2}
            r={halftone.radius}
            fill={halftone.dot}
          />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
