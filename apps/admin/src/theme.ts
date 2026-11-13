import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'slovo-admin-theme';

/** The Theme kept in storage; none when storage is blocked. */
function keptTheme(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function initialTheme(): Theme {
  const kept = keptTheme();
  if (kept === 'light' || kept === 'dark') return kept;
  // jsdom has no matchMedia.
  const dark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return dark ? 'dark' : 'light';
}

/**
 * The admin's Theme: the one the owner picked last, else the system's. It is
 * set on `<html data-theme>`, which the styles read.
 */
export function useTheme(): readonly [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.dataset['theme'] = theme;
  }, [theme]);
  const pick = (next: Theme) => {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Blocked storage only forgets the pick on the next visit.
    }
    setTheme(next);
  };
  return [theme, pick];
}
