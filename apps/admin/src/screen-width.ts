import { useSyncExternalStore } from 'react';

/** Tailwind's `md`: from here up the admin lays out for a desk, below for a phone. */
const WIDE = '(min-width: 768px)';

// jsdom has no matchMedia: a screen that can't tell is wide, the admin's first screen.
const media = () => (typeof window.matchMedia === 'function' ? window.matchMedia(WIDE) : undefined);

function subscribe(onChange: () => void) {
  const query = media();
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

/** Whether the screen is wide enough for the sidebar beside the section; else a phone. */
export function useWide(): boolean {
  return useSyncExternalStore(subscribe, () => media()?.matches ?? true);
}
