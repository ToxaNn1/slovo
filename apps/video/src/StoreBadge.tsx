import type { CSSProperties } from 'react';

import { light, uiFont } from './look';

export type Store = 'appStore' | 'googlePlay';

/** The badge's two lines per store, as the official Ukrainian badges word them. */
const lines: Record<Store, { small: string; big: string }> = {
  appStore: { small: 'Завантажити в', big: 'App Store' },
  googlePlay: { small: 'Завантажити з', big: 'Google Play' },
};

/** The official badge's proportions: about three wide to one high. */
export const storeBadgeRatio = 3;

/** The smallest height the badge may have, in layout units (`useLayout().s`). */
export const storeBadgeMinHeight = { portrait: 110, landscape: 90 } as const;

/**
 * The store badge: a black rounded plate in the official badge's proportions
 * with its two lines. Sized by `height` in frame pixels; the width follows.
 *
 * TODO(owner): the official badge artwork (the Apple logo, the Google Play
 * mark) is not drawn here. Put the official SVG in place of this plate, or
 * its logo left of the two lines, before publishing.
 */
export function StoreBadge({
  height,
  store = 'appStore',
  style,
}: {
  height: number;
  store?: Store;
  style?: CSSProperties;
}) {
  const text = lines[store];
  return (
    <div
      style={{
        width: height * storeBadgeRatio,
        height,
        boxSizing: 'border-box',
        borderRadius: height * 0.19,
        background: light.ink,
        border: `${Math.max(1, height * 0.012)}px solid rgba(255, 244, 230, 0.55)`,
        color: light.background,
        fontFamily: uiFont,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <div style={{ fontWeight: 500, fontSize: height * 0.2, lineHeight: 1.1 }}>{text.small}</div>
      <div style={{ fontWeight: 600, fontSize: height * 0.4, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
        {text.big}
      </div>
    </div>
  );
}
