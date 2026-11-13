import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/**
 * How much to draw a line smaller so it fits its room: the room's width from
 * `onRoomLayout`, the line's width at full size from `measured`, and their
 * scale, never above 1, or `undefined` until both are known. A point of slack
 * keeps rounding from pushing the line back over its room. A view not laid
 * out yet, or a measure with no lines, reports no width and is passed over,
 * so it never scales the line away.
 */
export function useFitToRoom(): {
  scale: number | undefined;
  onRoomLayout: (event: LayoutChangeEvent) => void;
  measured: (natural: number) => void;
} {
  const [room, setRoom] = useState<number>();
  const [natural, setNatural] = useState<number>();
  return {
    scale:
      room === undefined || natural === undefined ? undefined : Math.min(1, (room - 1) / natural),
    onRoomLayout: (event) => {
      const { width } = event.nativeEvent.layout;
      if (width > 0) setRoom(width);
    },
    measured: (width) => {
      if (Number.isFinite(width) && width > 0) setNatural(width);
    },
  };
}
