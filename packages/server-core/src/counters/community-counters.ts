import type { CounterEvent } from '@slovo/contracts';

import type { EditionRegistry, NotServing } from '../edition/edition-registry';
import type { Clock, CounterStore } from '../ports';
import { isoWeekOf } from './iso-week';

/** The Community Counters readers' devices send their changes to (ADR 0060). */
export interface CommunityCounters {
  /**
   * Adds the events' deltas to the Edition's counts, and each saved +1 to the
   * Entry's Favorites adds of the ISO week (UTC) it arrives in, when the
   * Edition serves Community Counters. Their shape is checked where they enter; whether
   * their Entries are in a pack is not.
   */
  send(request: {
    readonly editionId: string;
    readonly events: readonly CounterEvent[];
  }): Promise<{ readonly ok: true } | NotServing>;
}

export function createCommunityCounters({
  editions,
  store,
  clock,
}: {
  editions: EditionRegistry;
  store: CounterStore;
  clock: Clock;
}): CommunityCounters {
  return {
    async send({ editionId, events }) {
      const serving = await editions.serving(editionId, 'communityCounters');
      if (!serving.ok) return serving;
      await store.add(editionId, events, isoWeekOf(clock.now()));
      return { ok: true };
    },
  };
}
