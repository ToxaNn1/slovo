import { useLayout } from './look';

/** A box in frame pixels: `right` and `bottom` are coordinates, not insets. */
export type Box = { left: number; top: number; right: number; bottom: number };

/**
 * Where everything that matters must sit, in the pixels of the native frame.
 * 9:16 (1080×1920) goes to Reels, TikTok and Shorts, whose interface covers
 * the top, the bottom and a strip of buttons on the right; 16:9 (1920×1080)
 * keeps plain 5% margins.
 */
export const safeZone = {
  portrait: { left: 60, top: 240, right: 940, bottom: 1450 },
  landscape: { left: 96, top: 54, right: 1824, bottom: 1026 },
} as const satisfies Record<string, Box>;

/** Рупор's band in 9:16, in the pixels of the 1080×1920 frame. */
export const ruporBand = { top: 1000, bottom: 1400 } as const;

/** A row of tiles is never wider than this share of the frame's width. */
export const maxRowShare = 0.84;

export type Safe = Box & {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  /** The widest a row of tiles may be. */
  rowWidth: number;
  /** Where Рупор stands: his band in 9:16, the whole safe height in 16:9. */
  rupor: { top: number; bottom: number };
};

/** The safe zone of a `width`-wide frame of either shape, in that frame's own pixels. */
export function safeFor(portrait: boolean, width: number): Safe {
  const zone = portrait ? safeZone.portrait : safeZone.landscape;
  const s = width / (portrait ? 1080 : 1920);
  const left = zone.left * s;
  const top = zone.top * s;
  const right = zone.right * s;
  const bottom = zone.bottom * s;
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
    rowWidth: Math.min(right - left, width * maxRowShare),
    rupor: portrait ? { top: ruporBand.top * s, bottom: ruporBand.bottom * s } : { top, bottom },
  };
}

/** The safe zone of the Composition being drawn, in its pixels, with the layout it belongs to. */
export function useSafe() {
  const layout = useLayout();
  return { ...layout, safe: safeFor(layout.portrait, layout.width) };
}

/** The size of one tile so that `count` tiles with `gap` (a share of the tile) fit a row of `rowWidth`. */
export function tileSizeFor(count: number, rowWidth: number, gap = 0.12, max = Infinity) {
  return Math.min(max, rowWidth / (count + (count - 1) * gap));
}
