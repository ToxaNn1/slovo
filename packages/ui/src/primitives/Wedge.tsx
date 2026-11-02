import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import type { Wedge as WedgePoints } from '../tokens';

/**
 * A filled wedge of the design: the polygon's points, fractions of the box,
 * stretched over `width` × `height`. VoiceOver skips it.
 */
export function Wedge({
  points,
  color,
  width,
  height,
  style,
}: {
  points: WedgePoints;
  color: string;
  width: number | `${number}%`;
  height: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      accessible={false}
      style={style}
    >
      <Polygon points={points.map(([x, y]) => `${String(x)},${String(y)}`).join(' ')} fill={color} />
    </Svg>
  );
}
