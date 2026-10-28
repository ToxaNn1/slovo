import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { CollectionLinks } from '@slovo/server-core';

/**
 * The Collection Link procedures of the contract, over the server Core's
 * Collection Links. An unknown link, and both requests of an Edition with
 * Collection Links switched off, answer `NOT_FOUND` (ADR 0058).
 */
export function collectionLinksProcedures(links: CollectionLinks) {
  const collectionLinks = implement(apiContract.collectionLinks);
  return collectionLinks.router({
    create: collectionLinks.create.handler(async ({ input, errors }) => {
      const created = await links.create(input);
      if (!created.ok) throw errors.NOT_FOUND();
      return { id: created.id, url: created.url };
    }),
    read: collectionLinks.read.handler(async ({ input, errors }) => {
      const found = await links.read(input.id);
      if (!found.ok) throw errors.NOT_FOUND();
      return found.link;
    }),
  });
}
