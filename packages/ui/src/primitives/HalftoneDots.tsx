import { Circle, Pattern } from 'react-native-svg';

import { halftone } from '../tokens';

/** The design's halftone raster as an SVG pattern named `id`, for a `Defs`; a fill of `url(#id)` draws it. */
export function HalftoneDots({ id }: { id: string }) {
  return (
    <Pattern id={id} width={halftone.cell} height={halftone.cell} patternUnits="userSpaceOnUse">
      <Circle
        cx={halftone.cell / 2}
        cy={halftone.cell / 2}
        r={halftone.radius}
        fill={halftone.dot}
      />
    </Pattern>
  );
}
