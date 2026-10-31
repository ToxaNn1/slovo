import { useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useShell } from '../shell-value';

/**
 * Tells the composition each screen the reader views (ADR 0068), named by its
 * route, e.g. `/entry/[id]`, so no Entry id or other value leaves with it. It
 * waits for the composition's opening and draws nothing.
 */
export function ScreenViews() {
  const { composition } = useShell();
  const screen = `/${useSegments().join('/')}`;
  useEffect(() => {
    // The event never fails; a composition that fails to open is reported where it opens.
    composition.opened().then(
      (open) => open.analytics.screenViewed(screen),
      () => undefined,
    );
  }, [composition, screen]);
  return null;
}
