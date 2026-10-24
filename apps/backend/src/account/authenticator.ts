import { createHmac } from 'node:crypto';

import { SIGN_IN_CODE_DIGITS } from '@slovo/contracts';
import type { AccountRecord, Authenticator, CodeCheck } from '@slovo/server-core';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { bearer, emailOTP } from 'better-auth/plugins';
import { and, desc, eq } from 'drizzle-orm';
import type { Logger } from 'pino';

import type { Database } from '../database/database';
import { accounts, sessions, signInCodes, signInMethods } from '../database/schema';

/**
 * The rules of a Sign-in code (spec #333). better-auth enforces them, so they
 * are the adapter's: the server Core only passes on what checking a code gives.
 * Its digits are the contract's, which the app checks a typed code by too.
 */
const SIGN_IN_CODE = {
  digits: SIGN_IN_CODE_DIGITS,
  /** How long a code signs in after it is sent. */
  validSeconds: 10 * 60,
  /** How many codes may be tried, wrong ones included, before the code is spent. */
  tries: 5,
} as const;

/** How long a Session lasts after its last use: one used now and then never ends. */
const SESSION_SECONDS = 90 * 24 * 60 * 60;

/** How better-auth names Google among the Sign-in methods. */
const GOOGLE = 'google';

/** The kind of Sign-in code: better-auth's email OTP also has others SLOVO never uses. */
const SIGN_IN = 'sign-in';

/** How better-auth names the Sign-in code of an email in `sign_in_codes`. */
const codeIdentifier = (email: string) => `${SIGN_IN}-otp-${email}`;

/** A code's hash and the tries spent on it, from the value better-auth keeps: `<hash>:<tries>`. */
function readValue(value: string): { readonly hash: string; readonly triesSpent: number } {
  const colon = value.lastIndexOf(':');
  if (colon === -1) return { hash: value, triesSpent: 0 };
  return { hash: value.slice(0, colon), triesSpent: Number(value.slice(colon + 1)) };
}

/**
 * What the database keeps of the Sign-in code waiting for the email, expired
 * or not: its row's id and the code's hash; none when none is kept. For the
 * tests, which see what is kept without knowing how better-auth keeps it.
 */
export async function keptSignInCode(
  { db }: Database,
  email: string,
): Promise<{ readonly id: string; readonly hash: string } | undefined> {
  const [row] = await db
    .select()
    .from(signInCodes)
    .where(eq(signInCodes.identifier, codeIdentifier(email)))
    .orderBy(desc(signInCodes.createdAt))
    .limit(1);
  return row === undefined ? undefined : { id: row.id, hash: readValue(row.value).hash };
}

/** How long a Session's expiry stays put before a use moves it on (better-auth's default). */
const SESSION_UPDATE_SECONDS = 24 * 60 * 60;

const codeExpired: CodeCheck = { ok: false, reason: 'code-expired' };
const tooManyTries: CodeCheck = { ok: false, reason: 'too-many-tries' };

/**
 * A Session's token in the signed form the bearer plugin gives and demands
 * (ADR 0030): the token, a dot and its HMAC-SHA256 with the secret in
 * base64, as better-auth signs its Session cookie. The tests prove the form
 * by using a token signed here.
 */
const signedToken = (token: string, secret: string) =>
  `${token}.${createHmac('sha256', secret).update(token).digest('base64')}`;

/** The headers that carry a Session's token to better-auth. */
const bearerHeaders = (token: string) => new Headers({ authorization: `Bearer ${token}` });

/** An Account as the server Core sees it, from better-auth's user. */
const accountRecord = ({ id, email, createdAt }: AccountRecord): AccountRecord => ({
  id,
  email,
  createdAt,
});

/**
 * better-auth configured for SLOVO: Sign-in codes by email (its email OTP
 * plugin, codes kept hashed) and Sessions carried as bearer tokens. Its tables
 * are renamed to the glossary (ADR 0030). Nothing reaches its own HTTP
 * endpoints: the backend calls its server API only.
 */
function createAuth({
  database: { db },
  secret,
  logger,
}: {
  database: Database;
  secret: string;
  logger: Logger;
}) {
  return betterAuth({
    secret,
    // Nothing reaches better-auth's endpoints or redirects, so its own
    // address is never used; it only quiets its warning.
    baseURL: 'http://localhost',
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { accounts, signInMethods, sessions, signInCodes },
    }),
    user: { modelName: 'accounts' },
    account: {
      modelName: 'signInMethods',
      fields: { userId: 'accountId', accountId: 'providerAccountId' },
    },
    session: {
      modelName: 'sessions',
      fields: { userId: 'accountId' },
      expiresIn: SESSION_SECONDS,
      updateAge: SESSION_UPDATE_SECONDS,
    },
    verification: { modelName: 'signInCodes' },
    advanced: {
      database: { generateId: 'uuid' },
      // The backend keeps only the email (spec #333).
      ipAddress: { disableIpTracking: true },
    },
    // The sign-in limits are the server Core's, per email and per IP. better-auth's
    // own counts only requests to its HTTP endpoints, which nothing reaches.
    rateLimit: { enabled: false },
    telemetry: { enabled: false },
    // Only better-auth's message reaches the log: what it adds may hold an email.
    logger: {
      log: (level, message) => {
        logger[level]({ source: 'better-auth' }, message);
      },
    },
    plugins: [
      emailOTP({
        otpLength: SIGN_IN_CODE.digits,
        expiresIn: SIGN_IN_CODE.validSeconds,
        allowedAttempts: SIGN_IN_CODE.tries,
        storeOTP: 'hashed',
        // The server Core sends the email itself (createCode).
        sendVerificationOTP: () => Promise.resolve(),
      }),
      // A token must carry better-auth's signature, so the tokens in the
      // database alone sign nobody in (ADR 0030).
      bearer({ requireSignature: true }),
    ],
  });
}

/** The Authenticator on better-auth, over the backend's database. */
export function createAuthenticator(
  database: Database,
  { secret, logger }: { secret: string; logger: Logger },
): Authenticator {
  const auth = createAuth({ database, secret, logger });

  /** The tries spent on the code waiting for the email; none when no code waits. */
  async function triesSpent(email: string): Promise<number | undefined> {
    const { internalAdapter } = await auth.$context;
    const code = await internalAdapter.findVerificationValue(codeIdentifier(email));
    // better-auth reads the system clock, not the server Core's, so this does too.
    if (code === null || code.expiresAt.getTime() <= Date.now()) return undefined;
    return readValue(code.value).triesSpent;
  }

  return {
    async createCode(email) {
      const { internalAdapter } = await auth.$context;
      await internalAdapter.deleteVerificationByIdentifier(codeIdentifier(email));
      return auth.api.createVerificationOTP({ body: { email, type: SIGN_IN } });
    },

    async checkCode(email, code) {
      // A spent code stays spent, even for the right code, until a new one is sent.
      const spent = await triesSpent(email);
      if (spent === undefined) return codeExpired;
      if (spent >= SIGN_IN_CODE.tries) return tooManyTries;
      try {
        const { headers, response } = await auth.api.signInEmailOTP({
          body: { email, otp: code },
          returnHeaders: true,
        });
        // The bearer plugin gives the signed token here.
        const token = headers.get('set-auth-token');
        if (token === null) throw new Error('better-auth gave no Session token');
        return { ok: true, token, account: accountRecord(response.user) };
      } catch (error) {
        if (!(error instanceof APIError)) throw error;
        switch (error.body?.code) {
          case 'OTP_EXPIRED':
            return codeExpired;
          case 'TOO_MANY_ATTEMPTS':
            return tooManyTries;
          case 'INVALID_OTP': {
            const spentNow = await triesSpent(email);
            if (spentNow === undefined) return codeExpired;
            const triesLeft = SIGN_IN_CODE.tries - spentNow;
            return triesLeft > 0 ? { ok: false, reason: 'wrong-code', triesLeft } : tooManyTries;
          }
          default:
            throw error;
        }
      }
    },

    // better-auth's own social sign-in verifies the token itself, with no
    // way in for the server Core's verifier, so the adapter does what it
    // would: finds or creates the Account, records the Google identity as a
    // Sign-in method and starts a Session.
    async signInWithGoogle({ subject, email }) {
      const { internalAdapter, secret } = await auth.$context;
      const found = await internalAdapter.findUserByEmail(email);
      // SLOVO asks for no name; the email is verified by Google.
      const user =
        found?.user ??
        (await internalAdapter.createUser(
          { email, emailVerified: true, name: '' },
          { method: 'oauth', oauth: { providerId: GOOGLE } },
        ));
      // By the table: with the renamed fields (ADR 0030) better-auth reads a
      // Sign-in method back with the Account's id where the subject should be.
      const [linked] = await database.db
        .select({ id: signInMethods.id })
        .from(signInMethods)
        .where(
          and(
            eq(signInMethods.accountId, user.id),
            eq(signInMethods.providerId, GOOGLE),
            eq(signInMethods.providerAccountId, subject),
          ),
        );
      if (linked === undefined) {
        await internalAdapter.linkAccount({
          userId: user.id,
          providerId: GOOGLE,
          accountId: subject,
        });
      }
      const session = await internalAdapter.createSession(user.id);
      return { token: signedToken(session.token, secret), account: accountRecord(user) };
    },

    async sessionOf(token) {
      const session = await auth.api.getSession({ headers: bearerHeaders(token) });
      if (session === null) return undefined;
      return { id: session.session.id, account: accountRecord(session.user) };
    },

    async revoke(token) {
      // The signature checked, better-auth names the Session by the token it keeps.
      const session = await auth.api.getSession({
        headers: bearerHeaders(token),
        query: { disableRefresh: true },
      });
      if (session === null) return;
      const { internalAdapter } = await auth.$context;
      await internalAdapter.deleteSession(session.session.token);
    },

    async revokeAll(accountId) {
      const { internalAdapter } = await auth.$context;
      await internalAdapter.deleteUserSessions(accountId);
    },

    // better-auth's own deleteUser runs its deletes one by one, outside a
    // transaction, so the adapter deletes in one: the database's cascade takes
    // the Sessions, sign-in methods and Sync's records with the Account
    // (ADR 0030, 0041).
    async delete({ id, email }) {
      await database.db.transaction(async (tx) => {
        await tx.delete(signInCodes).where(eq(signInCodes.identifier, codeIdentifier(email)));
        await tx.delete(accounts).where(eq(accounts.id, id));
      });
    },
  };
}
