import type { CollectionLink } from '@slovo/contracts';

import { answerOf } from '../backend';
import type { Backend, RequestFailure } from '../ports';

/**
 * A Collection Link the backend didn't make or read, as any request may
 * fail, or because it serves no Collection Links for the Edition, has them
 * switched off, or knows no link of the id (404).
 */
export type CollectionLinksApiFailure =
  RequestFailure | { readonly ok: false; readonly reason: 'not-found' };

/** `NOT_FOUND`, the contract's answer to an unknown link or an Edition with Collection Links off. */
const notFound = ({ code }: { code: string }) =>
  code === 'NOT_FOUND' ? ({ ok: false, reason: 'not-found' } as const) : undefined;

/**
 * The requests of Collection Links to the backend, each answered as a value
 * (ADR 0064). They need no Account and send no Session (ADR 0058).
 */
export function collectionLinkRequests(backend: Pick<Backend, 'collectionLinks'>) {
  return {
    /** Stores the Collection as it is now and answers the link's id and its URL. */
    async create(
      link: CollectionLink,
    ): Promise<
      { readonly ok: true; readonly id: string; readonly url: string } | CollectionLinksApiFailure
    > {
      const answer = await answerOf(backend.collectionLinks.create(link), notFound);
      if (!answer.ok) return answer;
      return { ok: true, id: answer.output.id, url: answer.output.url };
    },
    /** The Collection as the link of the id holds it; `not-found` for an unknown id. */
    async read(
      id: string,
    ): Promise<{ readonly ok: true; readonly link: CollectionLink } | CollectionLinksApiFailure> {
      const answer = await answerOf(backend.collectionLinks.read({ id }), notFound);
      if (!answer.ok) return answer;
      return { ok: true, link: answer.output };
    },
  };
}
