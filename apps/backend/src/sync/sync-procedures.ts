import { apiContract } from '@slovo/contracts/api';
import type { Accounts, Sync } from '@slovo/server-core';

import { sessionGate, signedInRouter } from '../account/session-gate';
import { retryAfter } from '../retry-after';

/** What a request brings to the Sync procedures. */
interface SyncContext {
  readonly headers: Headers;
  /** The headers the answer gets (oRPC's `ResponseHeadersPlugin`). */
  readonly resHeaders?: Headers;
}

/** The Sync procedures of the contract, over the server Core's Sync. */
export function syncProcedures(sync: Sync, accounts: Accounts) {
  const records = signedInRouter(apiContract.sync).$context<SyncContext>();
  const signedIn = sessionGate(accounts);
  return records.router({
    push: records.push.use(signedIn).handler(async ({ input, context, errors }) => {
      const pushed = await sync.push(context.session, input.editionId, input.changes);
      if (pushed.ok) return {};
      switch (pushed.reason) {
        case 'unknown-edition':
        case 'switched-off':
          throw errors.NOT_FOUND();
        case 'too-many-requests':
          retryAfter(context, pushed);
          throw errors.TOO_MANY_REQUESTS();
        case 'too-large':
          throw errors.BAD_REQUEST();
        case 'too-many-records':
          throw errors.TOO_MANY_RECORDS();
      }
    }),

    pull: records.pull.use(signedIn).handler(async ({ input, context, errors }) => {
      const { editionId, after, limit } = input;
      const page = await sync.pull(context.session, editionId, { after, limit });
      if (page.ok) return { records: [...page.records], cursor: page.cursor, more: page.more };
      switch (page.reason) {
        case 'unknown-edition':
        case 'switched-off':
          throw errors.NOT_FOUND();
        case 'too-many-requests':
          retryAfter(context, page);
          throw errors.TOO_MANY_REQUESTS();
      }
    }),
  });
}
