import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { Accounts, Sync } from '@slovo/server-core';

import { sessionGate } from '../account/session-gate';

/** What a request brings to the Sync procedures. */
interface SyncContext {
  readonly headers: Headers;
}

/** The Sync procedures of the contract, over the server Core's Sync. */
export function syncProcedures(sync: Sync, accounts: Accounts) {
  const records = implement(apiContract.sync).$context<SyncContext>();
  const signedIn = sessionGate(accounts);
  return records.router({
    push: records.push.use(signedIn).handler(async ({ input, context, errors }) => {
      const pushed = await sync.push(context.session, input.editionId, input.changes);
      if (!pushed.ok) throw errors.NOT_FOUND();
      return {};
    }),

    pull: records.pull.use(signedIn).handler(async ({ input, context, errors }) => {
      const { editionId, after, limit } = input;
      const page = await sync.pull(context.session, editionId, { after, limit });
      if (!page.ok) throw errors.NOT_FOUND();
      return { records: [...page.records], cursor: page.cursor, more: page.more };
    }),
  });
}
