import type { ApiClient } from '@slovo/contracts/api';
import type { CollectionLinksApi } from '@slovo/core';

import { answerOf } from '../api';

/** `NOT_FOUND`, the contract's answer to an unknown link or an Edition with Collection Links off. */
const notFound = ({ code }: { code: string }) =>
  code === 'NOT_FOUND' ? ({ ok: false, reason: 'not-found' } as const) : undefined;

/**
 * The Core's `CollectionLinksApi` on the API contract's client. Collection
 * Links need no Account, so it sends no Session (ADR 0058).
 */
export function createCollectionLinksApi({
  client,
}: {
  client: Pick<ApiClient, 'collectionLinks'>;
}): CollectionLinksApi {
  return {
    async create(link) {
      const answer = await answerOf(client.collectionLinks.create(link), notFound);
      if (!answer.ok) return answer;
      return { ok: true, id: answer.output.id, url: answer.output.url };
    },
    async read(id) {
      const answer = await answerOf(client.collectionLinks.read({ id }), notFound);
      if (!answer.ok) return answer;
      return { ok: true, link: answer.output };
    },
  };
}
