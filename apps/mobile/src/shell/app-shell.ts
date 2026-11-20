import {
  openCounterSending,
  openMistakeReports,
  openRemoteSwitches,
  openSync,
  evaluateSwitches,
  readInstallId,
  systemRandom,
  type Account,
  type AnalyticsSink,
  type Edition,
  type FeatureSwitch,
  type ReaderFacts,
} from '@slovo/core';
import { systemSchedule } from '@slovo/ui';
import { getLocales } from 'expo-localization';

import { openDeviceAccount } from '../account/device-account';
import { backend } from '../api';
import { compositionOpening } from '../composition';
import { languagePackOpening } from '../content-update/language-pack';
import { deviceClock } from '../device/device-clock';
import { deviceFacts } from '../device/device-facts';
import { logError } from '../diagnostics/log';
import { activeEditionId, edition } from '../edition/edition';
import { openOnce, type Opening } from '../opening';
import { settingsOpening } from '../settings/settings';
import { deviceAnalytics } from '../analytics/posthog-analytics';
import { shareCardOnDevice, shareFileOnDevice } from '../share/device-share';
import { storedUserStateOpening } from '../user-state/stored-user-state';
import type { DevicePorts, DeviceSources, EditionSwitches, Shell } from '../shell-value';
import { editionAtLaunch } from '../edition/edition-at-launch';

/** The phone's two-letter region, when its locale names one: what the Rules and the statistics consent read. */
const deviceRegion = (): string | undefined => getLocales().at(0)?.regionCode ?? undefined;

/** The device's own sources for an Edition: its backend, clock, schedule, randomness, stored user state and region. */
function deviceSources(editionId: string): DeviceSources {
  return {
    backend,
    clock: deviceClock,
    schedule: systemSchedule,
    random: systemRandom,
    userState: storedUserStateOpening(editionId),
    region: deviceRegion,
  };
}

/**
 * How long the Account and Sync wait for the remote Rules the device kept to
 * be read before they open by the shipped states (ADR 0203).
 */
export const KEPT_RULES_WAIT_MS = 2000;

/** Why an opening stays closed: its Feature Switch is off in effect (ADR 0203). No failure, so nothing logs it. */
class SwitchedOffError extends Error {
  override readonly name = 'SwitchedOffError';
  constructor(feature: FeatureSwitch) {
    super(`The Feature Switch ${feature} is off in effect`);
  }
}

/**
 * Opens `open` over what `base` opened, on its first read, once per app run; a failure is logged as `failure`,
 * but a Feature Switch off in effect, which is none.
 */
function over<S, T>(
  base: Opening<S>,
  failure: string,
  open: (opened: S) => Promise<T> | T,
): Opening<T> {
  return openOnce(async () => open(await base.opened()), {
    onError(error) {
      if (!(error instanceof SwitchedOffError)) logError(failure, error);
    },
  });
}

/**
 * The Shell of the device for one Edition: every opening over that
 * Edition's user state, in the order they wait for each other. Nothing opens
 * until something reads it. The remote Feature Switches open over the
 * answer the device kept; every other opening opens over the one
 * set of device ports, which waits for the user state alone. Their Edition
 * in effect takes the remote switches once they are open, and the shipped
 * states (`editionAtLaunch`) until then or when they fail, so a slow or
 * failed answer holds nothing back. The Account and Sync open apart from the
 * composition; Sync, Mistake Reports and the Community Counters
 * apart from it too, and nothing waits for them. The Shell has an Account and
 * a Sync when the build shipped them on, the one reader here that takes the
 * shipped answer on purpose; each opens only while it is on in effect by the
 * Rules the device kept, and never waits for the backend (ADR 0203).
 */
export function createShell(
  editionId: string,
  sources: DeviceSources = deviceSources(editionId),
): Shell {
  const { userState } = sources;
  const installId = over(userState, 'Could not read the Install id', (opened) =>
    readInstallId({ userState: opened, random: sources.random }),
  );
  /** The Account once it is open: the reader's facts read it here, so working out the verdicts never opens it. */
  let openAccount: Account | undefined;
  /** The reader the Rules target, read afresh each time the verdicts are worked out. */
  const factsOf =
    (id: string): (() => ReaderFacts) =>
    () => ({
      ...deviceFacts,
      region: deviceRegion(),
      signedIn: openAccount?.state.status === 'signed-in',
      installId: id,
    });
  const remoteSwitches: Opening<EditionSwitches> = over(
    userState,
    'Could not open the remote Feature Switches',
    async (opened) =>
      openRemoteSwitches({
        ...sources,
        edition: editionAtLaunch,
        states: edition.featureSwitches,
        facts: factsOf(await installId.opened()),
        userState: opened,
      }),
  );
  // One Edition whose every read of a switch takes the remote ones as they stand.
  const editionInEffect: Edition = {
    ...editionAtLaunch,
    isFeatureEnabled(feature) {
      const switches = remoteSwitches.state;
      return (
        switches.status === 'ready' ? switches.value.edition : editionAtLaunch
      ).isFeatureEnabled(feature);
    },
  };
  /**
   * The launch-time choice (ADR 0203): settles once the Rules the device kept
   * are read, so what opens after it opens by the Edition in effect. A read
   * that fails or outlasts `KEPT_RULES_WAIT_MS` leaves the shipped states,
   * and the backend is never waited for.
   */
  const keptRulesRead = () =>
    new Promise<void>((resolve) => {
      const stopWaiting = sources.schedule(resolve, KEPT_RULES_WAIT_MS);
      const settle = () => {
        stopWaiting();
        resolve();
      };
      remoteSwitches.opened().then(settle, settle);
    });
  /**
   * Opens `open` over the device ports only while `feature` is on in effect
   * at launch; turned off, it stays closed, and a switch back on while the
   * app runs opens it. It follows the remote switches once while closed,
   * however often it is read.
   */
  function whileOn<T>(
    feature: FeatureSwitch,
    failure: string,
    open: (opened: DevicePorts) => Promise<T> | T,
  ): Opening<T> {
    let following = false;
    const opening: Opening<T> = over(ports, failure, async (opened) => {
      await keptRulesRead();
      if (editionInEffect.isFeatureEnabled(feature)) return open(opened);
      // Only the remote switches, open by now, turn off what shipped on.
      const switches = await remoteSwitches.opened();
      if (!following) {
        following = true;
        const stopFollowing = switches.subscribe(() => {
          if (!editionInEffect.isFeatureEnabled(feature)) return;
          stopFollowing();
          following = false;
          opening.opened().catch(() => undefined);
        });
      }
      throw new SwitchedOffError(feature);
    });
    return opening;
  }
  // The Analytics events carry the Install id and the Variants of the remote switches as they
  // stand; the Edition's own states, so no Variant, until they open (ADR 0068, 0089).
  const analytics = openOnce<AnalyticsSink>(
    async () => {
      const id = await installId.opened();
      const ownVerdicts = evaluateSwitches({
        rules: [],
        states: edition.featureSwitches,
        facts: { ...factsOf(id)(), clock: sources.clock, clockOffsetMs: 0 },
      });
      return {
        port: deviceAnalytics,
        switches: {
          installId: id,
          get verdicts() {
            const switches = remoteSwitches.state;
            return switches.status === 'ready' ? switches.value.verdicts : ownVerdicts;
          },
        },
      };
    },
    // The opening that failed under it has logged why.
    { onError: () => undefined },
  );
  const ports = openOnce<DevicePorts>(
    async () => {
      // Without the Install id there are no Analytics.
      const sink = await analytics.opened().catch(() => undefined);
      return {
        ...sources,
        userState: await userState.opened(),
        edition: editionInEffect,
        ...(sink === undefined ? {} : { analytics: sink }),
      };
    },
    // The opening that failed under it has logged why.
    { onError: () => undefined },
  );
  const languagePack = languagePackOpening({ remoteSwitches });
  const account = edition.isShippedOn('account')
    ? whileOn('account', 'Could not read the Session', async (opened) => {
        openAccount = await openDeviceAccount(opened);
        return openAccount;
      })
    : undefined;
  /**
   * The Account a Mistake Report goes out with, read as each report goes: none while it is
   * off in effect or failed to open, so a report never waits on it then.
   */
  const reportsAccount: Pick<Account, 'withSession'> | undefined = account && {
    async withSession(request) {
      if (!editionInEffect.isFeatureEnabled('account')) return undefined;
      const opened = await account.opened().catch(() => undefined);
      return opened?.withSession(request);
    },
  };
  return {
    userState,
    settings: settingsOpening({
      userState,
      edition: editionInEffect,
      analytics,
      backend: sources.backend,
      region: sources.region,
    }),
    remoteSwitches,
    languagePack,
    composition: compositionOpening({ languagePack, ports, account }),
    account,
    sync:
      account === undefined || !edition.isShippedOn('sync')
        ? undefined
        : whileOn('sync', 'Could not open Sync', async (opened) =>
            openSync({ ...opened, account: await account.opened() }),
          ),
    // Each report carries the app version the build declares and the content version of the Language Pack,
    // and goes out with the Session while the reader is signed in; an Account off in effect or
    // that failed to open leaves the reports anonymous.
    mistakeReports: over(ports, 'Could not open Mistake Reports', async (opened) =>
      openMistakeReports({
        ...opened,
        appVersion: deviceFacts.appVersion,
        contentVersion: (await languagePack.opened()).contentVersion,
        account: reportsAccount,
      }),
    ),
    counterSending: over(
      ports,
      'Could not open the sending of the Community Counters',
      openCounterSending,
    ),
    shareCard: shareCardOnDevice,
    shareFile: shareFileOnDevice,
  };
}

/**
 * The one Shell of the app run, for the Edition chosen at launch (ADR 0065). The root layout hands it to every screen
 * (`ShellProvider`); the links from outside the app, which Expo Router
 * resolves outside React, read it here.
 */
export const appShell = createShell(activeEditionId);
