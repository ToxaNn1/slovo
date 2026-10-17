import type { ApiClient } from '@slovo/contracts/api';
import type { ContentApi } from '@slovo/core';

import { answerOf } from '../api';

/** An Edition the backend doesn't serve, one with content updates off, or a pack not published. */
const notFound = { ok: false, reason: 'not-found' } as const;

/**
 * The Core's `ContentApi` for the running Edition, on the API contract's
 * client. The content procedures need no Account, so it sends no Session.
 */
export function createContentApi({
  client,
  editionId,
  readBytes,
}: {
  client: Pick<ApiClient, 'content'>;
  editionId: string;
  /** Reads the bytes of a downloaded file; React Native's `Blob` has no `arrayBuffer()`. */
  readBytes: (file: Blob) => Promise<Uint8Array>;
}): ContentApi {
  return {
    async latest(packFormat) {
      const answer = await answerOf(client.content.latest({ editionId, packFormat }), ({ code }) =>
        code === 'NOT_FOUND' ? notFound : undefined,
      );
      return answer.ok ? { ok: true, pack: answer.output.pack ?? undefined } : answer;
    },
    async download(contentVersion) {
      const answer = await answerOf(
        client.content.download({ params: { editionId, contentVersion } }),
        ({ code }) => (code === 'NOT_FOUND' ? notFound : undefined),
      );
      if (!answer.ok) return answer;
      // 304 answers only a download that names an ETag, which this one never does.
      if (answer.output.status !== 200) return { ok: false, reason: 'unexpected' };
      return { ok: true, bytes: await readBytes(answer.output.body) };
    },
  };
}
