import type { Composition, FeatureSwitch } from '@slovo/core';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { accountOpening } from './account/device-account';
import { compositionOpening } from './composition';
import { editionStrings } from './edition/edition';
import { deviceClock } from './device/device-clock';
import { languagePackOpening } from './edition/language-pack';
import { remoteSwitchesOpening } from './edition/remote-switches';
import { reportForeground } from './foreground/foreground-reports';
import { logError } from './log';
import { settingsOpening } from './settings/settings';
import { syncInBackground, reopenAfterSync } from './sync/background-sync';
import { syncOpening } from './sync/device-sync';
import { deviceWidget, deviceWidgetLinkKey } from './widget/device-widget';
import { createWidgetSnapshotWriter } from './widget/widget-snapshot';

/** Whether the feature is on in effect, by the remote Feature Switches the app knows (ADR 0040). */
async function isOnInEffect(feature: FeatureSwitch): Promise<boolean> {
  return (await remoteSwitchesOpening.opened()).edition.isFeatureEnabled(feature);
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
 * and the composition and writes the Widget Snapshot (spec #378). The Content update module checks then too, when content updates
 * are on in effect, at most once a day; the Account checks its Session then,
 * when it is on in effect, at most once an hour. Draws nothing.
 */
export function Lifecycle() {
  useEffect(() => {
    const reports = reportForeground({ clock: deviceClock, appState: AppState });
    reports.listen(compositionOpening, (composition, moment) => {
      if (moment !== 'return' && moment !== 'new-day') return;
      composition.resume().catch((error: unknown) => {
        logError('Could not follow the app into the foreground', error);
      });
    });
    const writeSnapshot = createWidgetSnapshotWriter(deviceWidget, deviceWidgetLinkKey);
    // The widget writes a Synonym Row's and a Tip's text in the Edition's words.
    const writeWidgetSnapshot = (widget: Composition['widget']) => {
      writeSnapshot(() => widget.snapshot(editionStrings.notificationBody));
    };
    reports.listen(compositionOpening, (composition, moment) => {
      if (moment === 'launch' || moment === 'background') writeWidgetSnapshot(composition.widget);
    });
    reports.listen(remoteSwitchesOpening, (switches, moment) => {
      if (moment !== 'launch' && moment !== 'return') return;
      // Neither the ask nor a reopen rejects.
      void switches.ask().then(async (changed) => {
        if (!changed) return;
        await compositionOpening.reopen();
        // A reopen does what the launch did: the composition makes the plan as it opens.
        const { state } = compositionOpening;
        if (state.status === 'ready') writeWidgetSnapshot(state.value.widget);
      });
    });
    if (syncOpening !== undefined) {
      syncInBackground({
        reports,
        sync: syncOpening,
        reopen: reopenAfterSync({
          settings: settingsOpening,
          composition: compositionOpening,
          writeWidgetSnapshot,
        }),
      });
    }
    reports.listen(languagePackOpening, ({ contentUpdate }, moment) => {
      if (moment !== 'launch' && moment !== 'return') return;
      // Neither rejects.
      void isOnInEffect('contentUpdates').then(async (on) => {
        if (on) await contentUpdate?.checkForUpdate();
      });
    });
    if (accountOpening !== undefined) {
      reports.listen(accountOpening, (account, moment) => {
        if (moment !== 'launch' && moment !== 'return') return;
        isOnInEffect('account')
          .then(async (on) => {
            if (on) await account.refresh();
          })
          .catch((error: unknown) => {
            logError('Could not refresh the Account', error);
          });
      });
    }
    return reports.stop;
  }, []);
  return null;
}
