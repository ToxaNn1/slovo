import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useModule } from './composition';
import { deviceClock } from './device-clock';
import { reportForeground } from './foreground-reports';

/**
 * The lifecycle adapter: it tells the composition the app is in the
 * foreground when the app comes back from the background, and on a timer
 * when the next local day starts while the app is open. The composition
 * decides what changed (a new local day, the permission). Draws nothing.
 */
export function Lifecycle() {
  const composition = useModule((open) => open);
  useEffect(() => {
    if (composition === undefined) return;
    return reportForeground({
      resume() {
        composition.resume().catch((error: unknown) => {
          console.error('Could not follow the app into the foreground', error);
        });
      },
      clock: deviceClock,
      onForeground(listener) {
        const subscription = AppState.addEventListener('change', (state) => {
          if (state === 'active') listener();
        });
        return () => {
          subscription.remove();
        };
      },
    });
  }, [composition]);
  return null;
}
