import type { CounterEvent } from '@slovo/contracts';

import type { EditionRegistry, NotServing } from '../edition/edition-registry';
import type { CounterStore } from '../ports';

/** The Community Counters readers' devices send their changes to (ADR 0060). */
export interface CommunityCounters {
  /**
   * Adds the events' deltas to the Edition's counts, when the Edition serves
   * Community Counters. Their shape is checked where they enter; whether
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
}: {
  editions: EditionRegistry;
  store: CounterStore;
}): CommunityCounters {
  return {
    async send({ editionId, events }) {
      const serving = await editions.serving(editionId, 'communityCounters');
      if (!serving.ok) return serving;
      await store.add(editionId, events);
      return { ok: true };
    },
  };
}
