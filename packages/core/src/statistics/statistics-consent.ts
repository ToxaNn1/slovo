import type { FeatureSwitch } from '@slovo/contracts';
import type { Edition } from '../edition/edition';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';

/**
 * The regions of the EEA as a phone's locale names them (ADR 0210): the 27
 * states of the EU with Iceland, Liechtenstein and Norway, and the parts of
 * an EU state that are in the EU under a region code of their own (Åland, the
 * Canary Islands, Ceuta and Melilla, the French overseas regions).
 */
// prettier-ignore
const EEA_REGIONS: ReadonlySet<string> = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
  'AX', 'IC', 'EA', 'GF', 'GP', 'MQ', 'YT', 'RE', 'MF',
]);

/**
 * The Statistics consent as one device reads it (ADR 0210): whether its
 * reader is one to ask before anything is sent.
 */
export interface StatisticsConsent {
  /**
   * Whether the reader is asked: the `statisticsConsent` Feature Switch is on
   * in effect and the phone's region is in the EEA or unknown. Read at each
   * call, so a Rule's change shows on the next one.
   */
  asks(): boolean;
}

/** A country's two-letter code; a locale may name another region, such as `150` for Europe. */
const COUNTRY_CODE = /^[A-Z]{2}$/;

/**
 * The Statistics consent of a phone of `region`, the region the Feature
 * Switch Rules read (ADR 0089): its two-letter code, or nothing where the
 * locale names none. A region that is no country code is unknown, and an
 * unknown region counts as the EEA (ADR 0210).
 */
export function statisticsConsentFor(
  edition: Pick<Edition, 'isFeatureEnabled'>,
  region: string | undefined,
): StatisticsConsent {
  const code = region?.toUpperCase();
  const inEea = code === undefined || !COUNTRY_CODE.test(code) || EEA_REGIONS.has(code);
  return { asks: () => inEea && edition.isFeatureEnabled('statisticsConsent') };
}

/** The Feature Switches of what «Ділитися анонімною статистикою» governs (ADR 0068). */
const GOVERNED: readonly FeatureSwitch[] = ['analytics', 'communityCounters'];

/**
 * Whether anything «Ділитися анонімною статистикою» governs is on: Analytics
 * or the Community Counters. Without either, «Конфіденційність» shows no
 * switch and nothing points the reader at it.
 */
export function statisticsGoverned(edition: Pick<Edition, 'isFeatureEnabled'>): boolean {
  return GOVERNED.some((feature) => edition.isFeatureEnabled(feature));
}

/**
 * Whether «Ділитися анонімною статистикою» is on in effect, the one answer
 * every sender of statistics asks (ADR 0068, 0210): the reader's choice, else
 * off for a reader to ask and on for any other. Without a `consent` no one is
 * asked.
 */
export async function sharesStatistics(
  userState: Pick<UserState, 'read'>,
  consent: StatisticsConsent | undefined,
): Promise<boolean> {
  return sharedBy(await userState.read(userStateRecords.shareCounters), consent);
}

/** `sharesStatistics` for a caller that read the reader's choice itself: `choice` is what the switch's record holds. */
export function sharedBy(
  choice: boolean | undefined,
  consent: StatisticsConsent | undefined,
): boolean {
  return choice ?? consent?.asks() !== true;
}

/** Whether the reader is still to ask: one the consent asks, with no choice kept. */
export async function statisticsConsentPending(
  userState: Pick<UserState, 'read'>,
  consent: StatisticsConsent | undefined,
): Promise<boolean> {
  return (
    consent?.asks() === true && (await userState.read(userStateRecords.shareCounters)) === undefined
  );
}
