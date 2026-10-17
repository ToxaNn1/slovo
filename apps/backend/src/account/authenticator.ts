import {
  SESSION_SECONDS,
  SIGN_IN_CODE,
  type Authenticator,
  type CodeCheck,
} from '@slovo/server-core';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { bearer, emailOTP } from 'better-auth/plugins';
import type { Logger } from 'pino';

import type { Database } from '../database/database';
import { accounts, sessions, signInCodes, signInMethods } from '../database/schema';

/** The kind of Sign-in code: better-auth's email OTP also has others SLOVO never uses. */
const SIGN_IN = 'sign-in';

/** How long a Session's expiry stays put before a use moves it on (better-auth's default). */
const SESSION_UPDATE_SECONDS = 24 * 60 * 60;

const codeExpired: CodeCheck = { ok: false, reason: 'code-expired' };
const tooManyTries: CodeCheck = { ok: false, reason: 'too-many-tries' };

/**
 * better-auth configured for SLOVO: Sign-in codes by email (its email OTP
 * plugin, codes kept hashed) and Sessions carried as bearer tokens. Its tables
 * are renamed to the glossary (ADR 0030). Nothing reaches its own HTTP
 * endpoints: the backend calls its server API only.
 */
function createAuth({ db }: Database, secret: string, logger: Logger) {
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
    // The limits are the server Core's (#343), not better-auth's.
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
  const auth = createAuth(database, secret, logger);
  // How better-auth names the Sign-in code of an email in `sign_in_codes`.
  const identifier = (email: string) => `${SIGN_IN}-otp-${email}`;

  /** The tries spent on the code waiting for the email; none when no code waits. */
  async function triesSpent(email: string): Promise<number | undefined> {
    const { internalAdapter } = await auth.$context;
    const code = await internalAdapter.findVerificationValue(identifier(email));
    if (code === null || code.expiresAt.getTime() <= Date.now()) return undefined;
    // better-auth keeps `<hash>:<tries spent>`.
    return Number(code.value.slice(code.value.lastIndexOf(':') + 1));
  }

  return {
    async createCode(email) {
      const { internalAdapter } = await auth.$context;
      await internalAdapter.deleteVerificationByIdentifier(identifier(email));
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
        const { id, createdAt } = response.user;
        return { ok: true, token, account: { id, email: response.user.email, createdAt } };
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

    async session(token) {
      const session = await auth.api.getSession({
        headers: new Headers({ authorization: `Bearer ${token}` }),
      });
      if (session === null) return undefined;
      const { id, email, createdAt } = session.user;
      return { account: { id, email, createdAt } };
    },
  };
}
