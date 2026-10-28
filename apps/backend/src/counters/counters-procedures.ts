import { implement } from '@orpc/server';
import { apiContract } from '@slovo/contracts/api';

/**
 * The Community Counters procedures of the contract. Until the backend keeps
 * the counters (#921, #922, #924), it answers each as an Edition with
 * Community Counters switched off: `NOT_FOUND`, which the app shows as no
 * line and no Community Word (ADR 0060).
 */
export function countersProcedures() {
  const counters = implement(apiContract.counters);
  const switchedOff = ({ errors }: { errors: { NOT_FOUND: () => Error } }) => {
    throw errors.NOT_FOUND();
  };
  return counters.router({
    send: counters.send.handler(switchedOff),
    read: counters.read.handler(switchedOff),
    communityWord: counters.communityWord.handler(switchedOff),
  });
}
