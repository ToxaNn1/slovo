import type { Platform } from '@slovo/contracts';

import { compareVersions, isAppVersion } from './app-version';
import type { RemoteSwitchesAnswer } from './remote-switches';

/** What the app asks of a reader whose build is old: nothing, an update, or an update before reading on. */
export type ForceUpdate = 'none' | 'banner' | 'blocking';

/** The device facts the force-update minimums are read against. */
export interface ForceUpdateFacts {
  readonly appVersion: string;
  readonly platform: Platform;
}

/**
 * What the force-update minimums of the kept switches answer ask of this
 * device (ADR 0089): below the hard minimum `blocking`, else below the soft
 * one `banner`, else `none`. Only the device's platform applies. A version
 * that doesn't read as one, the app's or a minimum, asks nothing, so a dev or
 * test build is never locked out.
 */
export function forceUpdateOf(
  minimums: RemoteSwitchesAnswer['minimums'],
  { appVersion, platform }: ForceUpdateFacts,
): ForceUpdate {
  const minimum = minimums[platform];
  if (minimum === undefined || !isAppVersion(appVersion)) return 'none';
  const below = (end: string | undefined) =>
    end !== undefined && isAppVersion(end) && compareVersions(appVersion, end) < 0;
  if (below(minimum.hard)) return 'blocking';
  if (below(minimum.soft)) return 'banner';
  return 'none';
}
