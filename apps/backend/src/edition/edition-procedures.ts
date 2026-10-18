import { createHash } from 'node:crypto';

import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { EditionRegistry } from '@slovo/server-core';

import { namesEtag } from '../etag';

/** The Edition procedures of the contract, over the server Core's Edition registry. */
export function editionProcedures(editions: EditionRegistry) {
  const edition = implement(apiContract.edition);
  return edition.router({
    switches: edition.switches.handler(async ({ input, errors }) => {
      const switches = await editions.remoteSwitches(input.params.editionId);
      if (!switches.ok) throw errors.NOT_FOUND();
      const body = { off: [...switches.off] };
      // The same switches always get the same ETag: the SHA-256 of the answer.
      const digest = createHash('sha256').update(JSON.stringify(body)).digest('hex');
      const headers = { etag: `"${digest}"` };
      if (namesEtag(input.headers?.['if-none-match'], headers.etag)) {
        return { status: 304 as const, headers };
      }
      return { status: 200 as const, headers, body };
    }),
  });
}
