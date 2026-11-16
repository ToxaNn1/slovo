import Svg, { Path, Polygon } from 'react-native-svg';

import { useTokens } from '../providers/TokensProvider';
import { tornThread } from '../tokens';

/**
 * The art of the error state «Нитка урвалася» (board XSettings m7): an ink
 * thread torn in two, a red wedge at each end of the break. VoiceOver skips
 * it; the title says what it shows.
 */
export function TornThread() {
  const { colors } = useTokens();
  const { width, height, stroke } = tornThread;
  return (
    <Svg
      testID="torn-thread"
      accessible={false}
      width={width}
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
    >
      <Path
        d="M0 30 Q30 10 60 30 T96 28"
        fill="none"
        stroke={colors.ink}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <Path
        d="M124 34 Q150 50 180 30 T220 30"
        fill="none"
        stroke={colors.ink}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <Polygon points="98,14 108,30 98,44" fill={colors.accent} />
      <Polygon points="122,16 112,32 122,46" fill={colors.accent} />
    </Svg>
  );
}
