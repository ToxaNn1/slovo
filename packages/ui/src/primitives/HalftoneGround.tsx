import { StyleSheet } from 'react-native';
import Svg, { ClipPath, Defs, G, Polygon, Rect } from 'react-native-svg';

import { useTokens } from '../providers/TokensProvider';
import { type Wedge } from '../tokens';
import { HalftoneDots } from './HalftoneDots';

/**
 * The design's red ground under its halftone raster, over `width` × `height`
 * and cut to `points` when given (fractions of the box, as `wedges` has
 * them). VoiceOver skips it.
 */
export function HalftoneGround({
  id,
  width,
  height,
  points,
}: {
  /** Unique on the screen: it names the raster and the cut. */
  id: string;
  width: number;
  height: number;
  points?: Wedge | undefined;
}) {
  const { colors } = useTokens();
  const cut = points?.map(([x, y]) => `${String(x * width)},${String(y * height)}`).join(' ');
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} accessible={false}>
      <Defs>
        <HalftoneDots id={`${id}-dots`} />
        {cut !== undefined && (
          <ClipPath id={`${id}-cut`}>
            <Polygon points={cut} />
          </ClipPath>
        )}
      </Defs>
      <G clipPath={cut === undefined ? undefined : `url(#${id}-cut)`}>
        <Rect width={width} height={height} fill={colors.accent} />
        <Rect width={width} height={height} fill={`url(#${id}-dots)`} />
      </G>
    </Svg>
  );
}
