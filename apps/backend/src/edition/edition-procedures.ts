import { createHash } from 'node:crypto';

import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { Clock, EditionRegistry } from '@slovo/server-core';

import { namesEtag } from '../etag';

/** The Edition procedures of the contract, over the server Core's Edition registry. */
export function editionProcedures(editions: EditionRegistry, clock: Clock) {
  const edition = implement(apiContract.edition);
  return edition.router({
    switches: edition.switches.handler(async ({ input, errors }) => {
      const switches = await editions.switches(input.params.editionId);
      if (!switches.ok) throw errors.NOT_FOUND();
      // The device reads no Edition id in a Rule: the address names it.
      const rules = switches.rules.map(({ id, feature, verdict, targets }) => ({
        id,
        feature,
        verdict,
        targets,
      }));
      const body = { rules, off: [...switches.off], minimums: switches.minimums };
      // The same switches always get the same ETag: the SHA-256 of the answer.
      const digest = createHash('sha256').update(JSON.stringify(body)).digest('hex');
      // The backend's clock, which the app keeps with the Rules (ADR 0089).
      const headers = { etag: `"${digest}"`, date: clock.now().toUTCString() };
      if (namesEtag(input.headers?.['if-none-match'], headers.etag)) {
        return { status: 304 as const, headers };
      }
      return { status: 200 as const, headers, body };
    }),
  });
}
