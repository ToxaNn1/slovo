import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { accountOpening } from './account/device-account';
import { compositionOpening } from './composition';
import { deviceClock } from './device/device-clock';
import { languagePackOpening } from './edition/language-pack';
import { createForeground } from './foreground/foreground';
import { reportForeground } from './foreground/foreground-reports';
import { deviceWidget } from './widget/device-widget';
import { createWidgetSnapshotWriter } from './widget/widget-snapshot';

/** The shell's one source of whether the app is in the foreground, for the Feed. */
const foreground = createForeground(AppState);

/** Whether the app is in the foreground, kept up to date. */
export function useInForeground(): boolean {
  return useSyncExternalStore(foreground.subscribe, foreground.active);
}

/**
 * The lifecycle adapter: it tells everything that follows the app's moments
 * (`reportForeground`), each once its own opening is open, so none waits for
 * another: the Account opens apart (ADR 0037). The composition hears each
 * return to the foreground and each next local day, and decides what changed
 * (a new local day, the permission). The Widget Snapshot is written when the
 * composition opens and each time the app goes to the background. The Content
 * update module checks at launch and each time the app comes back, when
 * content updates are on, at most once a day; the Account checks its Session
 * then too, at most once an hour. Draws nothing.
 */
export function Lifecycle() {
  useEffect(() => {
    const reports = reportForeground({ clock: deviceClock, appState: AppState });
    reports.listen(compositionOpening, (composition, moment) => {
      if (moment !== 'return' && moment !== 'new-day') return;
      composition.resume().catch((error: unknown) => {
        console.error('Could not follow the app into the foreground', error);
      });
    });
    const writeWidgetSnapshot = createWidgetSnapshotWriter(deviceWidget);
    reports.listen(compositionOpening, (composition, moment) => {
      if (moment === 'launch' || moment === 'background') {
        writeWidgetSnapshot(() => composition.widget.snapshot());
      }
    });
    reports.listen(languagePackOpening, ({ contentUpdate }, moment) => {
      // It never rejects.
      if (moment === 'launch' || moment === 'return') void contentUpdate?.checkForUpdate();
    });
    if (accountOpening !== undefined) {
      reports.listen(accountOpening, (account, moment) => {
        if (moment !== 'launch' && moment !== 'return') return;
        account.refresh().catch((error: unknown) => {
          console.error('Could not refresh the Account', error);
        });
      });
    }
    return reports.stop;
  }, []);
  return null;
}
