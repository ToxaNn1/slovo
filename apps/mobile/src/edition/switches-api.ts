import type { ApiClient } from '@slovo/contracts/api';
import type { SwitchesApi } from '@slovo/core';

import { answerOf } from '../api';

/**
 * The Core's `SwitchesApi` for the running Edition, on the API contract's
 * client. `edition.switches` needs no Account, so it sends no Session. An
 * Edition the backend doesn't serve is `unexpected`, as any other refusal.
 */
export function createSwitchesApi({
  client,
  editionId,
}: {
  client: Pick<ApiClient, 'edition'>;
  editionId: string;
}): SwitchesApi {
  return {
    async switches(etag) {
      const answer = await answerOf(
        client.edition.switches({
          params: { editionId },
          headers: etag === undefined ? {} : { 'if-none-match': etag },
        }),
      );
      if (!answer.ok) return answer;
      const { output } = answer;
      return output.status === 304
        ? { ok: true, answer: 'unchanged' }
        : { ok: true, answer: { off: output.body.off, etag: output.headers.etag } };
    },
  };
}
