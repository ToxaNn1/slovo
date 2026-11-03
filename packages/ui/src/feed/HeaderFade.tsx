import { useId } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { feedHeader } from '../tokens';

/**
 * The lower edge of a header over scrolled content: `color`, the screen's
 * background, fading to transparent downwards over `feedHeader.fade`, so a
 * card passes under the header softly instead of at a hard cut. It catches no
 * touches.
 */
export function HeaderFade({ color, testID }: { color: string; testID: string }) {
  const gradient = useId();
  return (
    <Svg testID={testID} pointerEvents="none" width="100%" height={feedHeader.fade}>
      <Defs>
        <LinearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={1} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${gradient})`} />
    </Svg>
  );
}
