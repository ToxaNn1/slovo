import type { Edition } from '../edition/edition';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

/**
 * Reads the phone's two-letter region as the Feature Switch Rules read it
 * (ADR 0089): nothing when the locale names none.
 */
export type RegionReader = () => string | undefined;

/** The countries of the EEA: the EU's 27, Iceland, Liechtenstein and Norway. */
const EEA = new Set([
  ...['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE'],
  ...['IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'],
  ...['IS', 'LI', 'NO'],
]);

/**
 * Whether a reader of this region is asked before any statistics are sent
 * (ADR 0204): a country of the EEA, or a region that names no country (none,
 * or a code that is not two letters), which counts as the EEA.
 */
export function needsStatisticsConsent(region: string | undefined): boolean {
  const country = region?.toUpperCase();
  return country === undefined || !/^[A-Z]{2}$/.test(country) || EEA.has(country);
}

const { shareCounters, statisticsConsentPending, onboardingFinished } = userStateRecords;

/**
 * Settles, once per install, whether this reader is asked for the statistics
 * consent (ADR 0204). A new reader who needs it has «Ділитися анонімною
 * статистикою» written off with the consent pending, so nothing is sent
 * until the onboarding's step gets an answer. Nothing changes for a reader
 * whose switch is already written (a choice, or a consent settled before),
 * for one who finished the onboarding before the rule, with the
 * `statisticsConsent` Feature Switch off, or with no region reader. Run it
 * before the first read of the switch; a second run changes nothing.
 */
export async function settleStatisticsConsent({
  edition,
  userState,
  region,
}: {
  edition: Pick<Edition, 'isFeatureEnabled'>;
  userState: Pick<UserState, 'read' | 'write'>;
  region: RegionReader | undefined;
}): Promise<void> {
  if (region === undefined || !edition.isFeatureEnabled('statisticsConsent')) return;
  if ((await userState.read(shareCounters)) !== undefined) return;
  if ((await userState.read(onboardingFinished)) !== undefined) return;
  if (!needsStatisticsConsent(region())) return;
  await userState.write(
    new Map([...shareCounters.change(false), ...statisticsConsentPending.change(true)]),
  );
}
