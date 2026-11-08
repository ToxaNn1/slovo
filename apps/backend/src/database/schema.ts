/**
 * The backend's tables, from which drizzle-kit generates the migrations
 * (`pnpm db:generate`). Tables are plural and snake_case, every time is a
 * `timestamptz` and every id a UUID (spec #333, Data model). The tables come
 * with the tickets that need them.
 */
import type {
  Correction,
  CrosswordDay,
  CuratedCollection,
  Idiom,
  MistakeType,
  Platform,
  RuleTargets,
  RuleVerdict,
  SynonymRow,
  Tip,
  Word,
} from '@slovo/contracts';
import type { Actor, Json } from '@slovo/server-core';
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
 * The remote Feature Switch Rules the owner sets (ADR 0089), one row per
 * Rule: for one Edition and one feature, tried in `order`. A feature's Rules
 * are replaced together; the Action log keeps the ones before.
 */
export const switchRules = pgTable(
  'switch_rules',
  {
    editionId: text('edition_id').notNull(),
    /** The name of the Feature Switch, such as `game`. */
    feature: text('feature').notNull(),
    order: integer('order').notNull(),
    /** The Rule's id, which salts the Rollout on the device. */
    ruleId: text('rule_id').notNull(),
    verdict: jsonb('verdict').$type<RuleVerdict>().notNull(),
    targets: jsonb('targets').$type<RuleTargets>().notNull(),
    setAt: time('set_at'),
  },
  (table) => [primaryKey({ columns: [table.editionId, table.feature, table.order] })],
);

/**
 * The force-update minimums of an Edition (ADR 0089), one row per platform:
 * below `soft` the app asks the reader to update, below `hard` it waits for it.
 */
export const forceUpdateMinimums = pgTable(
  'force_update_minimums',
  {
    editionId: text('edition_id').notNull(),
    platform: text('platform').$type<Platform>().notNull(),
    soft: text('soft'),
    hard: text('hard'),
    setAt: time('set_at'),
  },
  (table) => [primaryKey({ columns: [table.editionId, table.platform] })],
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
  // By Edition for `reports list --edition`, by time alone for every Edition.
  (table) => [index().on(table.editionId, table.receivedAt), index().on(table.receivedAt)],
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
 * The count of each answer to the onboarding questionnaire of each Edition
 * (ADR 0068): totals only, with no row and no column that names a reader.
 */
export const questionnaireCounters = pgTable(
  'questionnaire_counters',
  {
    editionId: text('edition_id').notNull(),
    /** The question answered: `level` or `why` (the rows of `who`, its name before, are kept). */
    question: text('question').notNull(),
    /** The id of the option chosen. */
    answer: text('answer').notNull(),
    /** The readers who chose it. */
    count: integer('count').notNull(),
  },
  (table) => [primaryKey({ columns: [table.editionId, table.question, table.answer] })],
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

/*
 * The content of every Edition (ADR 0090): one table per kind, the record's
 * fields as the contract's schema shapes them, with what each save keeps
 * beside them. Records are retired, never deleted.
 */

/** Who changed a record: the import, an admin (`admin:<Account id>`) or an Агент token (`agent:<name>`). */
export type ContentAuthor = 'import' | `admin:${string}` | `agent:${string}`;

/**
 * The batches of content writes: one import, one CLI run or one admin save
 * each, so a batch can be reviewed and rolled back as one.
 */
export const contentBatches = pgTable('content_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  editionId: text('edition_id').notNull(),
  changedBy: text('changed_by').$type<ContentAuthor>().notNull(),
  createdAt: time('created_at'),
  /** When the Content queue reviewed the batch; none while it is «не перевірено». */
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
});

/** The columns every content table has, with the record's fields typed by its contract. */
function contentColumns<Fields>() {
  return {
    editionId: text('edition_id').notNull(),
    id: text('id').notNull(),
    fields: jsonb('fields').$type<Fields>().notNull(),
    /** Raised by one on every change of the record. */
    recordVersion: integer('record_version').notNull(),
    /** The Edition's content version the record last changed at. */
    contentVersion: integer('content_version').notNull(),
    retired: boolean('retired').notNull(),
    changedBy: text('changed_by').$type<ContentAuthor>().notNull(),
    changedAt: time('changed_at'),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => contentBatches.id),
  };
}

const contentTable = <Fields>(name: string) =>
  pgTable(name, contentColumns<Fields>(), (table) => [
    primaryKey({ columns: [table.editionId, table.id] }),
    index().on(table.editionId, table.contentVersion),
  ]);

export const contentWords = pgTable(
  'content_words',
  {
    ...contentColumns<Word>(),
    /** Set when the Word's text changed after its Recordings were made. */
    needsNewRecording: boolean('needs_new_recording').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.editionId, table.id] }),
    index().on(table.editionId, table.contentVersion),
  ],
);
export const contentIdioms = contentTable<Idiom>('content_idioms');
export const contentCorrections = contentTable<Correction>('content_corrections');
export const contentTips = contentTable<Tip>('content_tips');
export const contentSynonymRows = contentTable<SynonymRow>('content_synonym_rows');
export const contentCuratedCollections = contentTable<CuratedCollection>(
  'content_curated_collections',
);
/** A Crossword day's id is its date. */
export const contentCrosswordDays = contentTable<CrosswordDay>('content_crossword_days');

/**
 * Every id an Edition ever gave, with its kind prefix in the id itself:
 * append-only, so an id never comes back with another meaning (ADR 0010).
 */
export const contentIds = pgTable(
  'content_ids',
  {
    editionId: text('edition_id').notNull(),
    id: text('id').notNull(),
    registeredAt: time('registered_at'),
  },
  (table) => [primaryKey({ columns: [table.editionId, table.id] })],
);

/**
 * The content version of each imported Edition: one integer that only grows,
 * raised on every publish. No row means the Edition is not imported, and its
 * content takes no writes.
 */
export const contentVersions = pgTable('content_versions', {
  editionId: text('edition_id').primaryKey(),
  contentVersion: integer('content_version').notNull(),
  importedAt: time('imported_at'),
  updatedAt: time('updated_at'),
});

/**
 * The quote check's last finding per quoted record (ADR 0084), at the record
 * version it checked. A record changed since, by any write other than an
 * import, has no row at its version: it is unverified.
 */
export const quoteChecks = pgTable(
  'quote_checks',
  {
    editionId: text('edition_id').notNull(),
    kind: text('kind').$type<'word' | 'correction' | 'idiom' | 'synonymRow' | 'tip'>().notNull(),
    id: text('id').notNull(),
    recordVersion: integer('record_version').notNull(),
    outcome: text('outcome').$type<'verified' | 'not-found'>().notNull(),
    /** What the check found when the quote is not on the page; none when verified. */
    finding: text('finding'),
    checkedAt: time('checked_at'),
  },
  (table) => [primaryKey({ columns: [table.editionId, table.kind, table.id] })],
);

/** The sourcing cache: the source pages the quote check fetched, each with when. */
export const sourcingCache = pgTable('sourcing_cache', {
  pageUrl: text('page_url').primaryKey(),
  /** The page's HTTP status: 200, or 404 for no such page. */
  httpStatus: integer('http_status').notNull(),
  body: text('body').notNull(),
  fetchedAt: time('fetched_at'),
});

/*
 * The admin's identities, apart from the Account tables (ADR 0088): Admin
 * users, their admin sessions and recovery codes, the Агент tokens, and the
 * Action log.
 */

/** The Admin users: a Власник (`owner`) or an Адмін (`admin`). */
export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** The email, trimmed and lower case. */
  email: text('email').notNull().unique(),
  role: text('role').$type<'owner' | 'admin'>().notNull(),
  /** The TOTP secret, sealed with a key of the backend's secret, set when the Admin user enrols at the first sign-in. */
  totpSecret: text('totp_secret'),
  /** When the TOTP first signed in; until then the secret is pending and set anew at each enrolment. */
  totpConfirmedAt: timestamp('totp_confirmed_at', { withTimezone: true }),
  state: text('state').$type<'active' | 'removed'>().notNull(),
  createdAt: time('created_at'),
});

/** The signed-in admin sessions, by the hash of the cookie's token. */
export const adminSessions = pgTable('admin_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  adminUserId: uuid('admin_user_id')
    .notNull()
    .references(() => adminUsers.id, { onDelete: 'cascade' }),
  createdAt: time('created_at'),
  /** The last request of the session: 8 idle hours end it. */
  lastSeenAt: time('last_seen_at'),
  expiresAt: time('expires_at'),
});

/** The one emailed code of an Admin user's email waiting to sign in, by hash; it lives 10 minutes. */
export const adminSignInCodes = pgTable('admin_sign_in_codes', {
  email: text('email').primaryKey(),
  codeHash: text('code_hash').notNull(),
  expiresAt: time('expires_at'),
});

/** The Admin user's one-time recovery codes, by hash; a used code keeps its `used_at`. */
export const recoveryCodes = pgTable('recovery_codes', {
  codeHash: text('code_hash').primaryKey(),
  adminUserId: uuid('admin_user_id')
    .notNull()
    .references(() => adminUsers.id, { onDelete: 'cascade' }),
  usedAt: timestamp('used_at', { withTimezone: true }),
});

/** The Агент tokens, one per named agent, kept as the token's SHA-256 only. */
export const agentTokens = pgTable('agent_tokens', {
  name: text('name').primaryKey(),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: time('created_at'),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

/** The Action log: one row per change, appended and never updated or deleted. */
export const actionLog = pgTable(
  'action_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    /** Who: an Admin user, an Агент or a server command. */
    who: jsonb('who').$type<Actor>().notNull(),
    at: time('at'),
    what: text('what').notNull(),
    before: jsonb('before').$type<Json>(),
    after: jsonb('after').$type<Json>(),
    reason: text('reason'),
    editionId: text('edition_id'),
    batchId: text('batch_id'),
  },
  (table) => [index('action_log_edition_id_idx').on(table.editionId)],
);
