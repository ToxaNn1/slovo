import type { CounterEvent } from '@slovo/contracts';

import type { EditionRegistry, NotServing } from '../edition/edition-registry';
import type { Clock, CounterStore, EntryCounts, RateLimits } from '../ports';
import { countRequest, ipSubject, type TooManyRequests } from '../rate-limit';
import { isoWeekOf } from './iso-week';

/** The counter events one IP address may send in a day, each event of a batch counting (ADR 0060). */
const EVENTS_PER_IP = { requests: 500, windowSeconds: 24 * 60 * 60 } as const;

/** The Community Counters readers' devices send their changes to (ADR 0060). */
export interface CommunityCounters {
  /**
   * Adds the events' deltas to the Edition's counts, and each saved +1 to the
   * Entry's Favorites adds of the ISO week (UTC) it arrives in, when the
   * Edition serves Community Counters. Their shape is checked where they enter; whether
   * their Entries are in a pack is not. A batch that takes its IP address
   * over the day's limit of events is refused whole; one its Edition doesn't
   * take counts nothing.
   */
  send(
    request: {
      readonly editionId: string;
      readonly events: readonly CounterEvent[];
    },
    ip: string,
  ): Promise<{ readonly ok: true } | NotServing | TooManyRequests>;
  /**
   * The counts of each Entry, in the order asked, when the Edition serves
   * Community Counters; an Entry nobody counted has zeros.
   */
  read(request: {
    readonly editionId: string;
    readonly entryIds: readonly string[];
  }): Promise<{ readonly ok: true; readonly counters: readonly EntryCounts[] } | NotServing>;
}

export function createCommunityCounters({
  editions,
  store,
  rateLimits,
  clock,
}: {
  editions: EditionRegistry;
  store: CounterStore;
  rateLimits: RateLimits;
  clock: Clock;
}): CommunityCounters {
  return {
    async send({ editionId, events }, ip) {
      const serving = await editions.serving(editionId, 'communityCounters');
      if (!serving.ok) return serving;
      const refused = await countRequest(
        rateLimits,
        `counterEventsPerIp:${ipSubject(ip)}`,
        EVENTS_PER_IP,
        clock.now(),
        events.length,
      );
      if (refused !== undefined) return refused;
      await store.add(editionId, events, isoWeekOf(clock.now()));
      return { ok: true };
    },

    async read({ editionId, entryIds }) {
      const serving = await editions.serving(editionId, 'communityCounters');
      if (!serving.ok) return serving;
      const kept = new Map(
        (await store.read(editionId, entryIds)).map((counts) => [counts.entryId, counts]),
      );
      const counters = entryIds.map(
        (entryId) => kept.get(entryId) ?? { entryId, known: 0, unknown: 0, saved: 0 },
      );
      return { ok: true, counters };
    },
  };
}
