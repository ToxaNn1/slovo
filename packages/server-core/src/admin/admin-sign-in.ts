import type { Clock, Mail, Mailer, Random, RateLimits } from '../ports';
import { blockAfterFailures, clearFailures, type TooManyRequests } from '../rate-limit';
import type { AdminRole, AdminStore, AdminUser, SecretVault } from './admin-access';

/** How long an emailed code lives. */
const CODE_LIFETIME_MS = 10 * 60 * 1000;
/** A session ends after this long unused… */
const SESSION_IDLE_MS = 8 * 60 * 60 * 1000;
/** …and this long after it began, used or not. */
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
/** Failed attempts on a code or a TOTP an email takes before it is blocked. */
const ATTEMPTS = 3;
const BLOCK_SECONDS = 15 * 60;
const RECOVERY_CODES = 10;
const TOTP_STEP_SECONDS = 30;

const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** A refusal of a sign-in step: a wrong or expired code with the attempts left, or the email blocked. */
export type SignInRefused =
  | { readonly ok: false; readonly reason: 'wrong-code'; readonly attemptsLeft: number }
  | TooManyRequests;

/** What the emailed code opens: the TOTP, or its set-up with the recovery codes shown this once. */
export type CodeAccepted =
  | { readonly ok: true; readonly next: 'totp' }
  | {
      readonly ok: true;
      readonly next: 'enrol';
      readonly secret: string;
      readonly otpauthUrl: string;
      readonly recoveryCodes: readonly string[];
    };

/** The second factor of a sign-in. */
export type SecondFactor =
  | { readonly kind: 'totp'; readonly totp: string }
  | { readonly kind: 'recovery'; readonly recoveryCode: string };

/** Who an admin session belongs to. */
export interface SignedInAdmin {
  readonly email: string;
  readonly role: AdminRole;
}

export type AdminSignedIn = { readonly ok: true; readonly token: string } & SignedInAdmin;

/** One of an Admin user's sessions, as «Мої сесії» lists it. */
export interface AdminSessionView {
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  /** Whether it is the session asking. */
  readonly current: boolean;
}

/** The admin's own sign-in (ADR 0088): an emailed code, then a TOTP or a recovery code. */
export interface AdminSignIn {
  /** Emails a code to an active Admin user; tells nothing of whether one exists. */
  requestCode(email: string): Promise<void>;
  /** Checks the emailed code without spending it, and answers what comes next. */
  verifyCode(email: string, code: string): Promise<CodeAccepted | SignInRefused>;
  /** Spends the code and the second factor, and begins a session. */
  signIn(email: string, code: string, factor: SecondFactor): Promise<AdminSignedIn | SignInRefused>;
  /** The Admin user of a session's token, while the session lasts; it counts as a use. */
  sessionOf(token: string): Promise<SignedInAdmin | undefined>;
  /** The sessions of the token's Admin user. */
  sessionsOf(token: string): Promise<readonly AdminSessionView[]>;
  signOut(token: string): Promise<void>;
  /** Ends every session of the token's Admin user, and of no one else. */
  signOutEverywhere(token: string): Promise<void>;
}

const normalized = (email: string) => email.trim().toLowerCase();

export function createAdminSignIn({
  store,
  clock,
  random,
  hash,
  mailer,
  rateLimits,
  hmacSha1,
  vault,
  codeEmail,
}: {
  store: AdminStore;
  clock: Clock;
  random: Random;
  /** A one-way hash of a code or token, the one the store keeps instead. */
  hash: (secret: string) => string;
  mailer: Mailer;
  rateLimits: RateLimits;
  /** HMAC-SHA1 of the message under the key, the hash of the TOTP. */
  hmacSha1: HmacSha1;
  /** Seals the TOTP secrets the store keeps. */
  vault: SecretVault;
  /** The email that carries a sign-in code, in the admin's language. */
  codeEmail: (code: string) => Omit<Mail, 'to'>;
}): AdminSignIn {
  const letters = (length: number, alphabet = LETTERS) =>
    Array.from({ length }, () => alphabet.charAt(random.int(alphabet.length))).join('');
  const failuresKey = (email: string) => `adminSignIn:${email}`;
  const codeHashOf = (email: string, code: string) => hash(`${email}:${code.trim()}`);

  /** Counts a failed attempt and answers the refusal it earns. */
  async function failed(email: string): Promise<SignInRefused> {
    const result = await blockAfterFailures(rateLimits, failuresKey(email), {
      attempts: ATTEMPTS,
      blockSeconds: BLOCK_SECONDS,
      now: clock.now(),
      failed: true,
    });
    return 'attemptsLeft' in result
      ? { ok: false, reason: 'wrong-code', attemptsLeft: result.attemptsLeft }
      : result;
  }

  /** The user whose emailed code is right; a refusal when it isn't or the email is blocked. */
  async function withCode(email: string, code: string): Promise<AdminUser | SignInRefused> {
    const blocked = await blockAfterFailures(rateLimits, failuresKey(email), {
      attempts: ATTEMPTS,
      blockSeconds: BLOCK_SECONDS,
      now: clock.now(),
      failed: false,
    });
    if (!('attemptsLeft' in blocked)) return blocked;
    const [user, kept] = await Promise.all([
      store.adminUserByEmail(email),
      store.signInCode(email),
    ]);
    const right =
      user !== undefined &&
      kept !== undefined &&
      kept.expiresAt > clock.now() &&
      kept.codeHash === codeHashOf(email, code);
    return right ? user : failed(email);
  }

  async function sessionRow(token: string) {
    const row = await store.adminSession(hash(token));
    if (row === undefined) return undefined;
    const now = clock.now().getTime();
    if (now - row.lastSeenAt.getTime() >= SESSION_IDLE_MS || now >= row.expiresAt.getTime()) {
      await store.deleteAdminSession(row.tokenHash);
      return undefined;
    }
    return row;
  }

  return {
    async requestCode(given) {
      const email = normalized(given);
      const user = await store.adminUserByEmail(email);
      if (user === undefined) return;
      const code = letters(6, '0123456789');
      await store.setSignInCode({
        email,
        codeHash: codeHashOf(email, code),
        expiresAt: new Date(clock.now().getTime() + CODE_LIFETIME_MS),
      });
      await mailer.send({ to: email, ...codeEmail(code) });
    },

    async verifyCode(given, code) {
      const email = normalized(given);
      const user = await withCode(email, code);
      if ('ok' in user) return user;
      if (user.totp.state === 'on') return { ok: true, next: 'totp' };
      const secret = letters(32, BASE32);
      const recoveryCodes = Array.from({ length: RECOVERY_CODES }, () =>
        letters(10, '23456789abcdefghjkmnpqrstuvwxyz'),
      );
      await store.setPendingTotp(
        user.id,
        vault.seal(secret),
        recoveryCodes.map((recovery) => hash(recovery)),
      );
      const label = encodeURIComponent(`SLOVO admin:${email}`);
      return {
        ok: true,
        next: 'enrol',
        secret,
        otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=SLOVO&digits=6&period=${String(TOTP_STEP_SECONDS)}`,
        recoveryCodes,
      };
    },

    async signIn(given, code, factor) {
      const email = normalized(given);
      const user = await withCode(email, code);
      if ('ok' in user) return user;
      const now = clock.now();
      const passed =
        factor.kind === 'totp'
          ? user.totp.state !== 'none' &&
            totpMatches(hmacSha1, vault.open(user.totp.sealedSecret), factor.totp, now)
          : user.totp.state === 'on' &&
            (await store.spendRecoveryCode(user.id, hash(factor.recoveryCode.trim()), now));
      if (!passed) return failed(email);
      await clearFailures(rateLimits, failuresKey(email));
      await store.deleteSignInCode(email);
      if (user.totp.state === 'pending') await store.confirmTotp(user.id, now);
      const token = letters(40);
      await store.addAdminSession({
        tokenHash: hash(token),
        adminUserId: user.id,
        createdAt: now,
        expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS),
      });
      return { ok: true, token, email: user.email, role: user.role };
    },

    async sessionOf(token) {
      const row = await sessionRow(token);
      if (row === undefined) return undefined;
      await store.touchAdminSession(row.tokenHash, clock.now());
      return { email: row.user.email, role: row.user.role };
    },

    async sessionsOf(token) {
      const row = await sessionRow(token);
      if (row === undefined) return [];
      const rows = await store.adminSessionsOf(row.user.id);
      const now = clock.now().getTime();
      return rows
        .filter(
          (session) =>
            now - session.lastSeenAt.getTime() < SESSION_IDLE_MS &&
            now < session.expiresAt.getTime(),
        )
        .map(({ tokenHash, createdAt, lastSeenAt }) => ({
          createdAt,
          lastSeenAt,
          current: tokenHash === row.tokenHash,
        }));
    },

    signOut: (token) => store.deleteAdminSession(hash(token)),

    async signOutEverywhere(token) {
      const row = await store.adminSession(hash(token));
      if (row !== undefined) await store.deleteAdminSessionsOf(row.user.id);
    },
  };
}

/** HMAC-SHA1 of the message under the key. */
export type HmacSha1 = (key: Uint8Array, message: Uint8Array) => Uint8Array;

/** The RFC 4648 bytes of a base32 text. */
function base32Bytes(text: string): Uint8Array {
  const bits = Array.from(text.toUpperCase().replace(/=+$/, ''))
    .map((letter) => BASE32.indexOf(letter).toString(2).padStart(5, '0'))
    .join('');
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  return bytes;
}

function hotp(hmacSha1: HmacSha1, secret: string, counter: number): string {
  const message = new DataView(new ArrayBuffer(8));
  message.setUint32(0, Math.floor(counter / 2 ** 32));
  message.setUint32(4, counter % 2 ** 32);
  const mac = hmacSha1(base32Bytes(secret), new Uint8Array(message.buffer));
  const offset = (mac[mac.length - 1] ?? 0) & 0xf;
  const binary =
    new DataView(mac.buffer, mac.byteOffset, mac.byteLength).getUint32(offset) & 0x7fffffff;
  return (binary % 1_000_000).toString().padStart(6, '0');
}

const stepOf = (at: Date) => Math.floor(at.getTime() / 1000 / TOTP_STEP_SECONDS);

/** The six-digit TOTP (RFC 6238, SHA-1, 30 seconds) of the base32 secret at `at`. */
export function totpOf(hmacSha1: HmacSha1, secret: string, at: Date): string {
  return hotp(hmacSha1, secret, stepOf(at));
}

/** Whether the TOTP is the secret's at `at`, or one step either side for a slow clock. */
function totpMatches(hmacSha1: HmacSha1, secret: string, totp: string, at: Date): boolean {
  const step = stepOf(at);
  const given = totp.trim();
  return [step - 1, step, step + 1].some((near) => hotp(hmacSha1, secret, near) === given);
}
