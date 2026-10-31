import { z } from 'zod';

import { SignInCodeSchema } from '../account';
import { EditionIdSchema } from '../edition';
import { procedure, signedIn } from './procedure';

/**
 * An email as the reader typed it. The backend makes the Account's email of
 * it by `AccountEmailSchema`.
 */
const TypedEmailSchema = z.string().max(320);

/**
 * A Google or Apple identity token as the provider's sign-in sheet gave it to
 * the app: a JWT, which the backend verifies. Both are under 2 KB; the limit
 * only keeps a request from carrying anything else.
 */
const IdTokenSchema = z.string().min(1).max(4096);

/** What a sign-in answers: the new Session's token and the Account's email. */
const SessionSchema = z.object({
  /** The Session's token, sent back as `Authorization: Bearer <token>`. */
  token: z.string(),
  /** The Account's email, trimmed and lower-cased. */
  email: z.string(),
});

/**
 * The input of an action that needs nothing but its Session: no body, or an
 * empty one, so a field naming another Account is refused (ADR 0031).
 */
const NoInputSchema = z.strictObject({}).optional();

/**
 * The Account procedures. They carry no Edition: one Account works in every
 * Edition (spec #333). Only the two that start a sign-in name one: the
 * Sign-in code request, so the email is in that Edition's language, and the
 * Google and the Apple sign-ins, for the Edition's `googleSignIn` and
 * `signInWithApple` Feature Switches and, for Apple, its bundle id.
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
    .errors({
      /** An Edition the backend doesn't serve, or one with the Account switched off. */
      NOT_FOUND: { message: 'Not found' },
      /** Over a limit of codes per email or of requests per IP; `Retry-After` says, in seconds, when to try again. */
      TOO_MANY_REQUESTS: { message: 'Too many requests' },
    })
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
      /**
       * Over the limit of checks per IP, with `Retry-After` in seconds; or every
       * try of the code is spent, without it, and only a new code signs in.
       */
      TOO_MANY_REQUESTS: { message: 'Too many requests' },
    })
    .input(z.strictObject({ email: TypedEmailSchema, code: SignInCodeSchema }))
    .output(SessionSchema),

  signInWithGoogle: procedure
    .route({
      method: 'POST',
      path: '/account/google-sessions',
      summary: 'Sign in with a Google identity token',
      description:
        "The backend verifies the token with Google's keys; the first sign-in of an email creates its Account, and an email with an Account reaches it, whatever Sign-in method made it (ADR 0047). The answer is the new Session's token.",
      tags: ['account'],
    })
    .errors({
      /** The token is not a Google identity token, its signature doesn't check, or it has expired. */
      INVALID_TOKEN: { status: 401, message: 'The token is not valid' },
      /** The token was issued to an app that is not SLOVO. */
      FOREIGN_AUDIENCE: { status: 401, message: 'The token is for another app' },
      /** Google has not verified the email, so it can't name an Account. */
      EMAIL_NOT_VERIFIED: { status: 403, message: 'The email is not verified' },
      /** An Edition the backend doesn't serve, or one with Google sign-in switched off or not configured. */
      NOT_FOUND: { message: 'Not found' },
      /** Over the limit of Google sign-ins per IP; `Retry-After` says, in seconds, when to try again. */
      TOO_MANY_REQUESTS: { message: 'Too many requests' },
    })
    .input(z.strictObject({ idToken: IdTokenSchema, editionId: EditionIdSchema }))
    .output(SessionSchema),

  signInWithApple: procedure
    .route({
      method: 'POST',
      path: '/account/apple-sessions',
      summary: 'Sign in with an Apple identity token',
      description:
        "The backend verifies the token with Apple's keys for the Edition's bundle id; the first sign-in of an email, a private relay address included, creates its Account, and an email with an Account reaches it, whatever Sign-in method made it (ADR 0047). The answer is the new Session's token.",
      tags: ['account'],
    })
    .errors({
      /** The token is not an Apple identity token, its signature doesn't check, or it has expired. */
      INVALID_TOKEN: { status: 401, message: 'The token is not valid' },
      /** The token was issued to an app that is not the Edition's. */
      FOREIGN_AUDIENCE: { status: 401, message: 'The token is for another app' },
      /** An Edition the backend doesn't serve, or one with Sign in with Apple switched off. */
      NOT_FOUND: { message: 'Not found' },
      /** Over the limit of Apple sign-ins per IP; `Retry-After` says, in seconds, when to try again. */
      TOO_MANY_REQUESTS: { message: 'Too many requests' },
    })
    .input(z.strictObject({ idToken: IdTokenSchema, editionId: EditionIdSchema }))
    .output(SessionSchema),

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

  signOut: signedIn
    .route({
      method: 'DELETE',
      path: '/account/sessions/current',
      summary: 'End this Session',
      description: "The Account's other Sessions go on.",
      tags: ['account'],
    })
    .input(NoInputSchema)
    .output(z.object({})),

  signOutEverywhere: signedIn
    .route({
      method: 'DELETE',
      path: '/account/sessions',
      summary: 'End every Session of the Account, this one included',
      tags: ['account'],
    })
    .input(NoInputSchema)
    .output(z.object({})),

  delete: signedIn
    .route({
      method: 'DELETE',
      path: '/account/me',
      summary: "Delete the Session's Account at once and for good",
      description:
        'Its Sessions and sign-in methods go with it, and so does any Sign-in code waiting for its email. There is no grace period; the same email can sign in again to a new, empty Account.',
      tags: ['account'],
    })
    .input(NoInputSchema)
    .output(z.object({})),
};
