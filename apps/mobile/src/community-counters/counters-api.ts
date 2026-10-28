import type { ApiClient } from '@slovo/contracts/api';
import type { CountersApi } from '@slovo/core';

import { answerOf } from '../api';

/**
 * The Core's `CountersApi` on the API contract's client for the running
 * Edition. It sends no Session, even when the reader is signed in (ADR 0060).
 */
export function createCountersApi({
  client,
  editionId,
}: {
  /** The client of a device that sends no Session. */
  client: Pick<ApiClient, 'counters'>;
  editionId: string;
}): CountersApi {
  return {
    async read(entryIds) {
      const answer = await answerOf(
        client.counters.read({ edition: editionId, entries: entryIds.join(',') }),
      );
      return answer.ok ? { ok: true, counters: answer.output.counters } : answer;
    },
  };
}
