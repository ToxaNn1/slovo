import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useComposition } from './composition';
import { deviceClock } from './device/device-clock';
import { languagePackOpening } from './edition/language-pack';
import { deviceWidget } from './widget/device-widget';
import { createForeground } from './foreground/foreground';
import { reportForeground } from './foreground/foreground-reports';
import { useOpened } from './opening';
import { writeWidgetSnapshots } from './widget/widget-snapshot';

/** The shell's one source of the foreground, for this adapter and the Feed alike. */
const foreground = createForeground(AppState);

/** Whether the app is in the foreground, kept up to date. */
export function useInForeground(): boolean {
  return useSyncExternalStore(foreground.subscribe, foreground.active);
}

/**
 * The lifecycle adapter: it tells the composition the app is in the
 * foreground when the app comes back from the background, and on a timer
 * when the next local day starts while the app is open. The composition
 * decides what changed (a new local day, the permission). It also writes the
 * Widget Snapshot once the composition is open and each time the app goes to
 * the background, and checks for a Content update at launch and each time the
 * app comes back, when content updates are on; the Content update module
 * checks at most once a day. Draws nothing.
 */
export function Lifecycle() {
  const composition = useComposition();
  const { contentUpdate } = useOpened(languagePackOpening);
  useEffect(() => {
    return reportForeground({
      resume() {
        composition.resume().catch((error: unknown) => {
          console.error('Could not follow the app into the foreground', error);
        });
      },
      clock: deviceClock,
      onForeground: (listener) =>
        foreground.subscribe(() => {
          if (foreground.active()) listener();
        }),
    });
  }, [composition]);
  useEffect(() => {
    return writeWidgetSnapshots({
      device: deviceWidget,
      snapshot: () => composition.widget.snapshot(),
      onBackground: (listener) => {
        const subscription = AppState.addEventListener('change', (state) => {
          if (state === 'background') listener();
        });
        return () => {
          subscription.remove();
        };
      },
    });
  }, [composition]);
  useEffect(() => {
    if (contentUpdate === undefined) return;
    // It never rejects.
    void contentUpdate.checkForUpdate();
    return foreground.subscribe(() => {
      if (foreground.active()) void contentUpdate.checkForUpdate();
    });
  }, [contentUpdate]);
  return null;
}
