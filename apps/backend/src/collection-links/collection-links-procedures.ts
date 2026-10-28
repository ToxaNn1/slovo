import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';

/**
 * The Collection Link procedures of the contract. Until the backend stores
 * links (#959), it answers both as for an Edition with Collection Links
 * switched off: `NOT_FOUND` (ADR 0058).
 */
export function collectionLinksProcedures() {
  const collectionLinks = implement(apiContract.collectionLinks);
  return collectionLinks.router({
    create: collectionLinks.create.handler(({ errors }) => {
      throw errors.NOT_FOUND();
    }),
    read: collectionLinks.read.handler(({ errors }) => {
      throw errors.NOT_FOUND();
    }),
  });
}
