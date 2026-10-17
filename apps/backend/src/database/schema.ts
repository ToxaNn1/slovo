/**
 * The backend's tables, from which drizzle-kit generates the migrations
 * (`pnpm db:generate`). Tables are plural and snake_case, every time is a
 * `timestamptz` and every id a UUID (spec #333, Data model). The tables come
 * with the tickets that need them.
 */
import { customType, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

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
