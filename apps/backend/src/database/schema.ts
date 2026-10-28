/**
 * The backend's tables, from which drizzle-kit generates the migrations
 * (`pnpm db:generate`). Tables are plural and snake_case, every time is a
 * `timestamptz` and every id a UUID (spec #333, Data model). The tables come
 * with the tickets that need them.
 */
import type { MistakeType } from '@slovo/contracts';
import type { Json } from '@slovo/server-core';
import {
  bigserial,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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
 * not the Account, which may not exist yet. Only the Authenticator
 * (src/account/authenticator.ts) knows the forms better-auth keeps them in.
 */
export const signInCodes = pgTable(
  'sign_in_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The email the code was sent to, in better-auth's form. */
    identifier: text('identifier').notNull(),
    /** The code's SHA-256 and the tries spent, in better-auth's form. */
    value: text('value').notNull(),
    expiresAt: time('expires_at'),
    createdAt: time('created_at'),
    updatedAt: time('updated_at'),
  },
  (table) => [index().on(table.identifier)],
);

/**
 * The windows the sign-in limits and Sync's limit of requests count requests
 * in (src/rate-limits.ts), one row per key: the HMAC of the limit with the
 * email, IP address or Session id it counts, so the table names none of them.
 * A row whose window has ended is deleted, so none is kept longer than its
 * limit needs.
 */
export const rateLimits = pgTable(
  'rate_limits',
  {
    /** The HMAC of the limit and what it counts (`codesPerEmail:<email>`), so no email or IP address is kept. */
    key: text('key').primaryKey(),
    /** The requests the window holds. */
    count: integer('count').notNull(),
    windowEnds: time('window_ends'),
  },
  (table) => [index().on(table.windowEnds)],
);

/**
 * The Feature Switches the owner turned off remotely (ADR 0040), one row per
 * Edition and feature. Clearing a switch keeps its row with `off` false, so a
 * row tells when its switch last changed.
 */
export const remoteSwitches = pgTable(
  'remote_switches',
  {
    editionId: text('edition_id').notNull(),
    /** The name of the Feature Switch, such as `game`. */
    feature: text('feature').notNull(),
    off: boolean('off').notNull(),
    setAt: time('set_at'),
  },
  (table) => [primaryKey({ columns: [table.editionId, table.feature] })],
);

/**
 * The records of every Account's user state, per Edition, that Sync keeps
 * (ADR 0041): one row per Account, Edition and key, kept as the device sent
 * it and never read. A deleted record stays as a tombstone, its `value` null,
 * so the deletion reaches every device; the Account's rows go with it.
 */
export const userRecords = pgTable(
  'user_records',
  {
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    editionId: text('edition_id').notNull(),
    /** The record's key in the user state, such as `favorites.<id>`. */
    key: text('key').notNull(),
    /** The record's value as JSON; null for a tombstone. */
    value: jsonb('value').$type<Json>(),
    /** When the device wrote the change, cut down to the server's time when later. */
    changedAt: time('changed_at'),
    /**
     * The next value of one sequence for every kept change, so a device pulls
     * what was kept after the last sequence it saw (its cursor).
     */
    sequence: bigserial('sequence', { mode: 'number' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.editionId, table.key] }),
    index().on(table.accountId, table.editionId, table.sequence),
  ],
);

/**
 * The Mistake Reports still to check (ADR 0056): one row per report, with
 * its time of arrival. It holds no IP address, no device id and no Account.
 * The owner deletes a report once it is checked, so the table keeps only
 * those still to check.
 */
export const mistakeReports = pgTable(
  'mistake_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    editionId: text('edition_id').notNull(),
    /** The id of the Entry reported, of any kind. */
    entryId: text('entry_id').notNull(),
    /** What is wrong: `typo`, `stress`, `definition` or `other`. */
    type: text('type').$type<MistakeType>().notNull(),
    /** The reader's comment, trimmed; empty when there is none. */
    comment: text('comment').notNull(),
    /** The app version the report came from (ADR 0044). */
    appVersion: text('app_version').notNull(),
    /** The content version of the Language Pack the reader had open. */
    contentVersion: integer('content_version').notNull(),
    receivedAt: time('received_at'),
  },
  (table) => [index().on(table.editionId, table.receivedAt)],
);

/**
 * The Community Counters (ADR 0060): one row per Edition and Entry with its
 * totals, each never below zero. A row holds no reader, IP address, device id
 * or Account, and there is no per-reader row, so nothing links two changes to
 * one reader.
 */
export const communityCounters = pgTable(
  'community_counters',
  {
    editionId: text('edition_id').notNull(),
    /** The id of the Entry counted, of any kind. */
    entryId: text('entry_id').notNull(),
    /** The readers who marked the Entry Known. */
    known: integer('known').notNull().default(0),
    /** The readers who marked the Entry Unknown. */
    unknown: integer('unknown').notNull().default(0),
    /** The readers who keep the Entry in their Favorites. */
    saved: integer('saved').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.editionId, table.entryId] })],
);

/**
 * The Favorites adds of each Edition, Entry and ISO week (UTC), for the
 * Community Word (ADR 0060): a week's adds only grow, since a Favorite removed
 * takes nothing from the week it was added in. Like the Community Counters, a
 * row holds no reader.
 */
export const favoritesAdds = pgTable(
  'favorites_adds',
  {
    editionId: text('edition_id').notNull(),
    /** The ISO week the adds arrived in, by its Monday (UTC). */
    week: date('week', { mode: 'string' }).notNull(),
    /** The id of the Entry added, of any kind. */
    entryId: text('entry_id').notNull(),
    /** The Favorites adds of the Entry in the week. */
    adds: integer('adds').notNull(),
  },
  (table) => [primaryKey({ columns: [table.editionId, table.week, table.entryId] })],
);

/**
 * The Collection Links (ADR 0058): one row per link with the Collection as it
 * was shared. A row is never updated, and holds no IP address, device id or
 * Account; only the owner's script deletes one.
 */
export const collectionLinks = pgTable('collection_links', {
  /** The link's 10 random letters and digits, the `<id>` of `c/<id>`. */
  id: text('id').primaryKey(),
  editionId: text('edition_id').notNull(),
  /** The Collection's name, trimmed. */
  name: text('name').notNull(),
  /** The Collection's Entry ids, in its order. */
  entryIds: text('entry_ids').array().notNull(),
  createdAt: time('created_at'),
});
