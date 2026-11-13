import type { Clock, Composition, FeatureSwitch } from '@slovo/core';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { editionStrings } from '../edition/edition';
import { deviceClock } from '../device/device-clock';
import type { AppStateSource } from '../foreground/foreground';
import { reportForeground } from '../foreground/foreground-reports';
import { logError } from '../diagnostics/log';
import { deviceSpotlight } from '../spotlight/device-spotlight';
import { handOverSpotlight } from '../spotlight/spotlight-hand-over';
import type { SpotlightIndex } from '../spotlight/spotlight-index';
import { reopenAfterSync, reopenComposition, syncInBackground } from '../sync/background-sync';
import { deviceWidget, deviceWidgetLinkKey } from '../widget/device-widget';
import { createWidgetSnapshotWriter } from '../widget/widget-snapshot';
import { useShell, type Shell } from '../shell-value';

/** What the lifecycle reaches on the device beside the Shell. */
export interface LifecycleDevice {
  readonly clock: Clock;
  readonly appState: AppStateSource;
  /** Writes the Widget Snapshot the widget builds. */
  readonly writeWidgetSnapshot: (widget: Composition['widget']) => void;
  readonly spotlight: SpotlightIndex;
}

/**
 * The lifecycle adapter: it tells everything that follows the app's moments
 * (`reportForeground`), each once its own opening is open, so none waits for
 * another: the Account opens apart (ADR 0037). The composition hears each
 * return to the foreground and each next local day, and decides what changed
 * (a new local day, the permission). The Widget Snapshot is written when the
 * composition opens and each time the app goes to the background. The remote
 * Feature Switches are asked for at launch and each time the app comes back,
 * and a changed answer reopens the composition over the Edition in effect and
 * writes the Widget Snapshot again (ADR 0040). Sync follows the foreground and
 * the background, and a sync that changed the user state reopens the settings
 * and the composition and writes the Widget Snapshot (spec #378). The
 * Spotlight Snapshot is handed to the iPhone search when the composition
 * opens or reopens, each time the app goes to the background and after each
 * change of Favorites, the Collections or the Word of the Day archive (ADR
 * 0057). The Content update module checks then too, when content updates
 * are on in effect, at most once a day; the Account checks its Session then,
 * when it is on in effect, at most once an hour. Mistake Reports send their
 * queue at launch and on each return (ADR 0056). The Community Counters send
 * their unsent changes at launch, on each return and every few minutes while
 * the app is in the foreground (ADR 0060). Returns the call that stops
 * listening.
 */
export function listen(shell: Shell, device: LifecycleDevice): () => void {
  const { composition, remoteSwitches, languagePack, account, sync } = shell;
  const { writeWidgetSnapshot } = device;
  /** Whether the feature is on in effect, by the remote Feature Switches the app knows (ADR 0040). */
  async function isOnInEffect(feature: FeatureSwitch): Promise<boolean> {
    return (await remoteSwitches.opened()).edition.isFeatureEnabled(feature);
  }
  const reports = reportForeground({ clock: device.clock, appState: device.appState });
  reports.listen(composition, (opened, moment) => {
    if (moment !== 'return' && moment !== 'new-day') return;
    opened.resume().catch((error: unknown) => {
      logError('Could not follow the app into the foreground', error);
    });
  });
  reports.listen(composition, (opened, moment) => {
    if (moment === 'launch' || moment === 'background') writeWidgetSnapshot(opened.widget);
  });
  // A Visit runs from a launch or a return to the background (spec #1709); its events never fail.
  reports.listen(composition, (opened, moment) => {
    if (moment === 'launch' || moment === 'return') void opened.analytics.sessionStarted();
    if (moment === 'background') void opened.analytics.sessionEnded();
  });
  function logSwitchesError(error: unknown) {
    logError('Could not follow the remote Feature Switches', error);
  }
  /** Reopens what read the old switches once an ask changed an effective value, or the old records once a Patch came. */
  const reopenOver = reopenComposition(composition, writeWidgetSnapshot);
  // The switches are asked at launch, on each return and every two minutes in the foreground (ADR 0089).
  let stopAsking: () => void = () => undefined;
  reports.listen(remoteSwitches, (switches, moment) => {
    if (moment === 'background') stopAsking();
    if (moment !== 'launch' && moment !== 'return') return;
    switches
      .ask()
      .then(async (changed) => {
        if (changed) await reopenOver();
      })
      .catch(logSwitchesError);
    stopAsking();
    stopAsking = switches.start(() => {
      reopenOver().catch(logSwitchesError);
    });
  });
  const stopSpotlight = handOverSpotlight({
    reports,
    composition,
    index: device.spotlight,
    strings: editionStrings,
  });
  if (sync !== undefined) {
    syncInBackground({
      reports,
      sync,
      reopen: reopenAfterSync({ settings: shell.settings, composition, writeWidgetSnapshot }),
    });
  }
  // While the app is in the foreground it checks for a Patch at once and every 15 minutes (ADR 0090).
  let stopFollowing: () => void = () => undefined;
  let unsubscribePatches: () => void = () => undefined;
  reports.listen(languagePack, ({ contentUpdate }, moment) => {
    if (contentUpdate === undefined) return;
    if (moment === 'launch') {
      // A Patch changed the records: the composition reopens over them, as after a remote switch.
      unsubscribePatches = contentUpdate.subscribe(() => {
        void reopenOver();
      });
    }
    if (moment === 'background') {
      stopFollowing();
      return;
    }
    if (moment !== 'launch' && moment !== 'return') return;
    isOnInEffect('contentUpdates')
      .then(async (on) => {
        if (!on) return;
        stopFollowing();
        stopFollowing = contentUpdate.followForeground();
        await contentUpdate.checkForUpdate();
      })
      .catch((error: unknown) => {
        logError('Could not check for a content update', error);
      });
  });
  reports.listen(shell.mistakeReports, (mistakeReports, moment) => {
    if (moment === 'launch' || moment === 'return') mistakeReports.foreground();
  });
  reports.listen(shell.counterSending, (counterSending, moment) => {
    if (moment === 'launch' || moment === 'return') counterSending.foreground();
    if (moment === 'background') counterSending.background();
  });
  if (account !== undefined) {
    reports.listen(account, (opened, moment) => {
      if (moment !== 'launch' && moment !== 'return') return;
      isOnInEffect('account')
        .then(async (on) => {
          if (on) await opened.refresh();
        })
        .catch((error: unknown) => {
          logError('Could not refresh the Account', error);
        });
    });
  }
  return () => {
    stopAsking();
    stopSpotlight();
    stopFollowing();
    unsubscribePatches();
    reports.stop();
  };
}

/** The Widget Snapshot's writer of the device; the widget writes a Synonym Row's and a Tip's text in the Edition's words. */
const writeSnapshot = createWidgetSnapshotWriter(deviceWidget, deviceWidgetLinkKey);

const device: LifecycleDevice = {
  clock: deviceClock,
  appState: AppState,
  writeWidgetSnapshot(widget) {
    writeSnapshot(() => widget.snapshot(editionStrings.notificationBody));
  },
  spotlight: deviceSpotlight,
};

/** The lifecycle adapter of the app run, over the Shell it is drawn under (`listen`). Draws nothing. */
export function Lifecycle() {
  const shell = useShell();
  useEffect(() => listen(shell, device), [shell]);
  return null;
}
