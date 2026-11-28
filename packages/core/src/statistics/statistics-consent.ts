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
 * The time zones of the EEA as a phone names them (ADR 0212): those of the
 * states of `EEA_REGIONS`, and of the parts of an EU state with a time zone of
 * their own (Büsingen, Åland, the Canary Islands, Ceuta, Madeira, the Azores,
 * the French overseas regions).
 */
// prettier-ignore
const EEA_TIME_ZONES: ReadonlySet<string> = new Set([
  'Europe/Vienna', 'Europe/Brussels', 'Europe/Sofia', 'Europe/Zagreb', 'Asia/Nicosia',
  'Europe/Nicosia', 'Asia/Famagusta', 'Europe/Prague', 'Europe/Copenhagen', 'Europe/Tallinn',
  'Europe/Helsinki', 'Europe/Mariehamn', 'Europe/Paris', 'Europe/Berlin', 'Europe/Busingen',
  'Europe/Athens', 'Europe/Budapest', 'Europe/Dublin', 'Europe/Rome', 'Europe/Riga',
  'Europe/Vilnius', 'Europe/Luxembourg', 'Europe/Malta', 'Europe/Amsterdam', 'Europe/Warsaw',
  'Europe/Lisbon', 'Atlantic/Madeira', 'Atlantic/Azores', 'Europe/Bucharest', 'Europe/Bratislava',
  'Europe/Ljubljana', 'Europe/Madrid', 'Africa/Ceuta', 'Atlantic/Canary', 'Europe/Stockholm',
  'Atlantic/Reykjavik', 'Europe/Vaduz', 'Europe/Oslo',
  'America/Cayenne', 'America/Guadeloupe', 'America/Martinique', 'America/Marigot',
  'Indian/Mayotte', 'Indian/Reunion',
]);

/**
 * The Statistics consent as one device reads it (ADR 0210, 0212): whether its
 * reader is one to ask before anything is sent.
 */
export interface StatisticsConsent {
  /**
   * Whether the reader is asked: the `statisticsConsent` Feature Switch is on
   * in effect and the phone's region is in the EEA or unknown, or its time
   * zone is in the EEA. Read at each call, so a Rule's change shows on the
   * next one.
   */
  asks(): boolean;
}

/** A country's two-letter code; a locale may name another region, such as `150` for Europe. */
const COUNTRY_CODE = /^[A-Z]{2}$/;

/**
 * The Statistics consent of a phone of `region`, the region the Feature
 * Switch Rules read (ADR 0089): its two-letter code, or nothing where the
 * locale names none; and of `timeZone`, the IANA time zone the phone is set
 * to. A region that is no country code is unknown, and an unknown region
 * counts as the EEA (ADR 0210); a time zone of the EEA does too, whatever the
 * region (ADR 0212). Both are read on the phone only; nothing is sent.
 */
export function statisticsConsentFor(
  edition: Pick<Edition, 'isFeatureEnabled'>,
  { region, timeZone }: { readonly region: string | undefined; readonly timeZone: string },
): StatisticsConsent {
  const code = region?.toUpperCase();
  const inEea =
    code === undefined ||
    !COUNTRY_CODE.test(code) ||
    EEA_REGIONS.has(code) ||
    EEA_TIME_ZONES.has(timeZone);
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
