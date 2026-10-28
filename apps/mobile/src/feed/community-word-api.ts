import type { ApiClient } from '@slovo/contracts/api';
import type { CommunityWordApi } from '@slovo/core';

import { answerOf } from '../api';

/**
 * The Core's `CommunityWordApi` for the running Edition, on the API
 * contract's client. `counters.communityWord` needs no Account, so it sends
 * no Session (ADR 0060).
 */
export function createCommunityWordApi({
  client,
  editionId,
}: {
  client: Pick<ApiClient, 'counters'>;
  editionId: string;
}): CommunityWordApi {
  return {
    async communityWord() {
      const answer = await answerOf(client.counters.communityWord({ edition: editionId }));
      if (!answer.ok) return answer;
      return { ok: true, communityWord: answer.output.communityWord ?? undefined };
    },
  };
}
