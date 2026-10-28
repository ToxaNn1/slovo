import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { CollectionLinks } from '@slovo/server-core';

import { retryAfter } from '../retry-after';

/** What a request brings to the Collection Link procedures. */
interface CollectionLinksContext {
  /** The IP address of the request's connection, which the day's limit counts and nothing keeps. */
  readonly ip: string;
  /** The headers the answer gets (oRPC's `ResponseHeadersPlugin`). */
  readonly resHeaders?: Headers;
}

/**
 * The Collection Link procedures of the contract, over the server Core's
 * Collection Links. An unknown link, and both requests of an Edition with
 * Collection Links switched off, answer `NOT_FOUND`, and a link over the
 * day's limit of its IP address `TOO_MANY_REQUESTS` with `Retry-After` (ADR 0058).
 */
export function collectionLinksProcedures(links: CollectionLinks) {
  const collectionLinks = implement(apiContract.collectionLinks).$context<CollectionLinksContext>();
  return collectionLinks.router({
    create: collectionLinks.create.handler(async ({ input, context, errors }) => {
      const created = await links.create(input, context.ip);
      if (created.ok) return { id: created.id, url: created.url };
      switch (created.reason) {
        case 'unknown-edition':
        case 'switched-off':
          throw errors.NOT_FOUND();
        case 'too-many-requests':
          retryAfter(context, created);
          throw errors.TOO_MANY_REQUESTS();
      }
    }),
    read: collectionLinks.read.handler(async ({ input, errors }) => {
      const found = await links.read(input.id);
      if (!found.ok) throw errors.NOT_FOUND();
      return found.link;
    }),
  });
}
