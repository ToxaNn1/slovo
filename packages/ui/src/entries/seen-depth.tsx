import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useIsPageOnScreen } from '../primitives/VerticalPager';

/**
 * How far down an Entry card's tab content the reader has had in view, in
 * points from its top: all of it while it fits its room, down to the cut while
 * it is clamped, down to the lowest reach of the scroll once opened, and none
 * while the tab is still fitting itself to its room. All of it outside a tab.
 */
export const SeenDepthContext = createContext(Number.POSITIVE_INFINITY);

/**
 * Calls `onSeen` once the element given the returned `onLayout` has been in
 * view down to its middle, on a page on screen: what the reader has really
 * seen, not what is drawn below the cut or on a page waiting off screen. The
 * element is a direct child of the tab's content, so its layout is in the
 * content's points.
 */
export function useSeenOnce(onSeen: (() => void) | undefined): (event: LayoutChangeEvent) => void {
  const depth = useContext(SeenDepthContext);
  const onScreen = useIsPageOnScreen();
  const [middle, setMiddle] = useState<number | undefined>(undefined);
  const seen = onScreen && middle !== undefined && depth >= middle;
  const told = useRef(false);
  useEffect(() => {
    if (!seen || told.current || onSeen === undefined) return;
    told.current = true;
    onSeen();
  }, [seen, onSeen]);
  return (event) => {
    const { y, height } = event.nativeEvent.layout;
    setMiddle(y + height / 2);
  };
}
