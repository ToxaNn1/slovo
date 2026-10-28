import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { CommunityCounters } from '@slovo/server-core';

import { retryAfter } from '../retry-after';

/** The counters change slowly and name no reader, so any cache may keep them a day. */
const COUNTERS_CACHE_CONTROL = 'public, max-age=86400';

/** What a request brings to the Community Counters procedures. */
interface CountersContext {
  /** The IP address of the request's connection, which the day's limit counts. */
  readonly ip: string;
  /** The headers the answer gets (oRPC's `ResponseHeadersPlugin`). */
  readonly resHeaders?: Headers;
}

/**
 * The Community Counters procedures of the contract, over the server Core's
 * Community Counters. An Edition with Community Counters switched off answers
 * `NOT_FOUND`, which the app shows as no line and no Community Word, and a
 * batch over the day's limit of events of its IP address `TOO_MANY_REQUESTS`
 * with `Retry-After` (ADR 0060). The counters read may be kept for 24 hours,
 * as the device keeps them. Until the backend answers the Community Word
 * (#925), it answers it as switched off.
 */
export function countersProcedures(communityCounters: CommunityCounters) {
  const counters = implement(apiContract.counters).$context<CountersContext>();
  const switchedOff = ({ errors }: { errors: { NOT_FOUND: () => Error } }) => {
    throw errors.NOT_FOUND();
  };
  return counters.router({
    send: counters.send.handler(async ({ input, context, errors }) => {
      const sent = await communityCounters.send(input, context.ip);
      if (sent.ok) return;
      switch (sent.reason) {
        case 'unknown-edition':
        case 'switched-off':
          throw errors.NOT_FOUND();
        case 'too-many-requests':
          retryAfter(context, sent);
          throw errors.TOO_MANY_REQUESTS();
      }
    }),
    read: counters.read.handler(async ({ input, context, errors }) => {
      const read = await communityCounters.read({
        editionId: input.edition,
        entryIds: input.entries,
      });
      if (!read.ok) throw errors.NOT_FOUND();
      context.resHeaders?.set('cache-control', COUNTERS_CACHE_CONTROL);
      return { counters: [...read.counters] };
    }),
    communityWord: counters.communityWord.handler(switchedOff),
  });
}
