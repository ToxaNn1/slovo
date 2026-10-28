import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';
import type { CommunityCounters } from '@slovo/server-core';

/**
 * The Community Counters procedures of the contract, over the server Core's
 * Community Counters. An Edition with Community Counters switched off answers
 * `NOT_FOUND`, which the app shows as no line and no Community Word
 * (ADR 0060). Until the backend reads the counters (#924) and answers the
 * Community Word (#925), it answers those as switched off.
 */
export function countersProcedures(communityCounters: CommunityCounters) {
  const counters = implement(apiContract.counters);
  const switchedOff = ({ errors }: { errors: { NOT_FOUND: () => Error } }) => {
    throw errors.NOT_FOUND();
  };
  return counters.router({
    send: counters.send.handler(async ({ input, errors }) => {
      const sent = await communityCounters.send(input);
      if (!sent.ok) throw errors.NOT_FOUND();
    }),
    read: counters.read.handler(switchedOff),
    communityWord: counters.communityWord.handler(switchedOff),
  });
}
