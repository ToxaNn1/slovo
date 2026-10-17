import { z } from 'zod';

import { EditionIdSchema } from '../edition';
import { procedure } from './procedure';

/** A Sign-in code as the reader types it: six digits. */
const SignInCodeSchema = z.string().regex(/^[0-9]{6}$/, 'Expected six digits');

/**
 * An email as the reader typed it. The backend trims it, lower-cases it and
 * then checks that it is an email.
 */
const TypedEmailSchema = z.string().max(320);

/** A procedure that acts on an Account: it carries a Session as `Authorization: Bearer <token>`. */
const signedIn = procedure.errors({
  /** The request carries no Session, or one that has ended. */
  UNAUTHORIZED: { message: 'Not signed in' },
});

/**
 * The Account procedures. They carry no Edition: one Account works in every
 * Edition (spec #333). Only the Sign-in code request names one, so the email
 * is in that Edition's language.
 */
export const accountContract = {
  requestCode: procedure
    .route({
      method: 'POST',
      path: '/account/sign-in-codes',
      summary: 'Send a Sign-in code to an email',
      description: 'The answer is the same whether or not the email has an Account.',
      tags: ['account'],
    })
    // An Edition the backend doesn't serve, or one with the Account switched off.
    .errors({ NOT_FOUND: { message: 'Not found' } })
    .input(z.strictObject({ email: TypedEmailSchema, editionId: EditionIdSchema }))
    .output(z.object({})),

  verifyCode: procedure
    .route({
      method: 'POST',
      path: '/account/sessions',
      summary: 'Sign in with the Sign-in code last sent to an email',
      description:
        "The first right code for an email creates its Account. The answer is the new Session's token.",
      tags: ['account'],
    })
    .errors({
      /** The code is not the one last sent; the reader may try again. */
      WRONG_CODE: {
        status: 400,
        message: 'Wrong code',
        data: z.object({ triesLeft: z.number().int().positive() }),
      },
      /** No code is waiting for the email: it ran out of time, or none was sent. */
      CODE_EXPIRED: { status: 400, message: 'The code has expired' },
      /** Every try of the code is spent; only a new code signs in. */
      TOO_MANY_REQUESTS: { message: 'Too many requests' },
    })
    .input(z.strictObject({ email: TypedEmailSchema, code: SignInCodeSchema }))
    .output(
      z.object({
        /** The Session's token, sent back as `Authorization: Bearer <token>`. */
        token: z.string(),
        /** The Account's email, trimmed and lower-cased. */
        email: z.string(),
      }),
    ),

  me: signedIn
    .route({
      method: 'GET',
      path: '/account/me',
      summary: "The Session's Account",
      tags: ['account'],
    })
    .output(
      z.object({
        email: z.string(),
        /** When the Account was created. */
        createdAt: z.iso.datetime(),
      }),
    ),
};
