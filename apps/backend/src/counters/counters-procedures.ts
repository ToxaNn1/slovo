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
 * as the device keeps them. An Edition with the Community Word switched off
 * answers its Community Word `NOT_FOUND` too, so the Community Word needs both
 * switches on. A questionnaire answer of an Edition with the questionnaire
 * switched off, or one that is not an option of its question, answers
 * `NOT_FOUND` (ADR 0068).
 */
export function countersProcedures(communityCounters: CommunityCounters) {
  const counters = implement(apiContract.counters).$context<CountersContext>();
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
    communityWord: counters.communityWord.handler(async ({ input, errors }) => {
      const answer = await communityCounters.communityWord(input.edition);
      if (!answer.ok) throw errors.NOT_FOUND();
      return { communityWord: answer.communityWord ?? null };
    }),
    questionnaire: counters.questionnaire.handler(async ({ input, context, errors }) => {
      const answered = await communityCounters.answer(input, context.ip);
      if (answered.ok) return;
      switch (answered.reason) {
        case 'unknown-edition':
        case 'switched-off':
        case 'unknown-answer':
          throw errors.NOT_FOUND();
        case 'too-many-requests':
          retryAfter(context, answered);
          throw errors.TOO_MANY_REQUESTS();
      }
    }),
  });
}
