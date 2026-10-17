import { ORPCError, type ApiClient } from '@slovo/contracts/api';
import type { ContentApi, ContentApiFailure } from '@slovo/core';

import { requestFailure } from '../api';

/** A failure of a content procedure: the Edition or the pack not found (404), or one any call may end in. */
function contentFailure(error: unknown): ContentApiFailure {
  if (error instanceof ORPCError && error.status === 404) return { ok: false, reason: 'not-found' };
  return requestFailure(error);
}

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
      try {
        const { pack } = await client.content.latest({ editionId, packFormat });
        return { ok: true, pack: pack ?? undefined };
      } catch (error) {
        return contentFailure(error);
      }
    },
    async download(contentVersion) {
      let answer;
      try {
        answer = await client.content.download({ params: { editionId, contentVersion } });
      } catch (error) {
        return contentFailure(error);
      }
      // 304 answers only a download that names an ETag, which this one never does.
      if (answer.status !== 200) {
        throw new Error(`The download of a pack got ${String(answer.status)}`);
      }
      return { ok: true, bytes: await readBytes(answer.body) };
    },
  };
}
