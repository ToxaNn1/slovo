/**
 * The backend's tables, from which drizzle-kit generates the migrations
 * (`pnpm db:generate`). Tables are plural and snake_case, every time is a
 * `timestamptz` and every id a UUID (spec #333, Data model). The tables come
 * with the tickets that need them.
 */
import {
  boolean,
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/** Raw bytes, such as a Language Pack file. */
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => 'bytea',
  toDriver: (bytes) => Buffer.from(bytes),
  fromDriver: (buffer) => new Uint8Array(buffer),
});

/**
 * The published Language Packs of every Edition, one row each with the bytes
 * of the pack file. A row is never updated: a content version, once
 * published, is immutable (ADR 0011).
 */
export const contentPacks = pgTable(
  'content_packs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    editionId: text('edition_id').notNull(),
    contentVersion: integer('content_version').notNull(),
    packFormat: integer('pack_format').notNull(),
    /** The checksum of the pack's content (ADR 0011), not of the file. */
    contentChecksum: text('content_checksum').notNull(),
    /** The SHA-256 of the pack file, as 64 lowercase hex digits. */
    fileSha256: text('file_sha256').notNull(),
    /** The size of the pack file, in bytes. */
    size: integer('size').notNull(),
    bytes: bytea('bytes').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  },
  (table) => [unique().on(table.editionId, table.contentVersion)],
);

/** A time, as every table keeps it. */
const time = (name: string) => timestamp(name, { withTimezone: true }).notNull();

/*
 * The Account's tables are better-auth's, renamed to the glossary through its
 * model names (ADR 0030): its `user` is `accounts`, its `account` is
 * `sign_in_methods`, its `session` is `sessions` and its `verification` is
 * `sign_in_codes` (src/account/authenticator.ts). A column better-auth needs
 * but SLOVO never fills says so.
 */

/** Every Account: one per email, shared by every Edition. */
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Trimmed and lower-cased. */
  email: text('email').notNull().unique(),
  /** better-auth's; SLOVO asks for no name, so it stays empty. */
  name: text('name').notNull(),
  /** better-auth's; an Account's email is proven by its first Sign-in code. */
  emailVerified: boolean('email_verified').notNull(),
  /** better-auth's; SLOVO asks for no image, so it stays empty. */
  image: text('image'),
  createdAt: time('created_at'),
  updatedAt: time('updated_at'),
});

/**
 * How an Account signs in other than by a Sign-in code, which needs no row:
 * Sign in with Apple and Google arrive in 0.9. better-auth's tokens and
 * password columns come with the table; SLOVO has no passwords, so
 * `password` stays empty.
 */
export const signInMethods = pgTable(
  'sign_in_methods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    /** The provider, such as `apple`. */
    providerId: text('provider_id').notNull(),
    /** The Account's id at the provider. */
    providerAccountId: text('provider_account_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: time('created_at'),
    updatedAt: time('updated_at'),
  },
  (table) => [index().on(table.accountId)],
);

/** Every Session: one device's sign-in to an Account. Ending a Session deletes its row. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    /** The token the device sends as `Authorization: Bearer`; kept as it is (ADR 0030). */
    token: text('token').notNull().unique(),
    /** Moves on each day the Session is used. */
    expiresAt: time('expires_at'),
    /** better-auth's; the backend keeps no IP address, so it stays empty. */
    ipAddress: text('ip_address'),
    /** better-auth's; the backend keeps no user agent, so it stays empty. */
    userAgent: text('user_agent'),
    createdAt: time('created_at'),
    updatedAt: time('updated_at'),
  },
  (table) => [index().on(table.accountId)],
);

/**
 * The Sign-in codes waiting for their email, hashed. They hang off the email,
 * not the Account, which may not exist yet.
 */
export const signInCodes = pgTable(
  'sign_in_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The email the code was sent to, as better-auth names it: `sign-in-otp-<email>`. */
    identifier: text('identifier').notNull(),
    /** The code's SHA-256 and the tries spent, as better-auth keeps them: `<hash>:<tries>`. */
    value: text('value').notNull(),
    expiresAt: time('expires_at'),
    createdAt: time('created_at'),
    updatedAt: time('updated_at'),
  },
  (table) => [index().on(table.identifier)],
);
