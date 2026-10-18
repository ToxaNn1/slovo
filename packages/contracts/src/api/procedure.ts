import { oc } from '@orpc/contract';

/**
 * Where every procedure of the contract starts: the error codes any procedure
 * can answer. A procedure adds its own codes with `.errors(…)`. A failure the
 * contract doesn't list is a bare `500 { code: "INTERNAL" }`.
 */
export const procedure = oc.errors({
  /** The request breaks the procedure's input, an unknown field included. */
  BAD_REQUEST: { message: 'The request is not valid' },
});

/** A procedure that acts on an Account: it carries a Session as `Authorization: Bearer <token>`. */
export const signedIn = procedure.errors({
  /** The request carries no Session, or one that has ended. */
  UNAUTHORIZED: { message: 'Not signed in' },
});
