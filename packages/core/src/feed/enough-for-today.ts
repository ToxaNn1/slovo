import type { FeatureSwitch } from '@slovo/contracts';

import type { FeedNotices } from './feed-notices';
import { dateKeyOf, localDayOf } from '../local-date';
import type { Clock } from '../ports';
import type { History } from '../saved/history';

/** The distinct Entries Seen on a local day after which the Feed asks «Може, на сьогодні досить?». */
export const ENOUGH_FOR_TODAY_SEEN = 50;

/**
 * «Може, на сьогодні досить?» as a Feed Notice (ADR 0066): on a local day once
 * the distinct Entries Seen on it, the Word of the Day included, reach 50.
 * History keeps one entry per Entry, its last Seen, so an Entry Seen again
 * counts once. The Entry the card follows counts too, so the card comes right
 * after the 50th. It has no setting and never locks the Feed; swiping past it
 * closes it for the day, as every Feed Notice. Never while its Feature Switch
 * is off.
 */
export function enoughForTodayNotices({
  edition,
  history,
  clock,
}: {
  edition: { isFeatureEnabled(feature: FeatureSwitch): boolean };
  history: Pick<History, 'list'>;
  clock: Clock;
}): FeedNotices {
  return {
    forDay(day, after) {
      if (!edition.isFeatureEnabled('enoughForToday')) return Promise.resolve([]);
      const date = dateKeyOf(day);
      const seen = new Set(
        history.list.flatMap(({ entryId, seenAt }) =>
          dateKeyOf(localDayOf(seenAt, clock).date) === date ? [entryId] : [],
        ),
      );
      if (after !== undefined) seen.add(after);
      return Promise.resolve(
        seen.size >= ENOUGH_FOR_TODAY_SEEN ? [{ notice: 'enoughForToday' as const }] : [],
      );
    },
  };
}
