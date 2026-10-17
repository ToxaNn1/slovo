import {
  PackMetadataSchema,
  type Category,
  type Correction,
  type PackMetadata,
  type Word,
} from '@slovo/contracts';

/**
 * The SQLite layout of a Language Pack. It is internal to this package: the
 * mobile shell and tests read packs through the Core's content read port.
 */
export const PACK_SCHEMA = `
CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  position INTEGER NOT NULL
) WITHOUT ROWID;

-- Every Entry, whatever its kind.
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('word', 'correction'))
) WITHOUT ROWID;

CREATE TABLE words (
  id TEXT PRIMARY KEY REFERENCES entries (id),
  lemma TEXT NOT NULL,
  part_of_speech TEXT NOT NULL,
  gender TEXT,
  category_id TEXT NOT NULL REFERENCES categories (id),
  rarity INTEGER NOT NULL,
  etymology TEXT,
  retired INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE word_stress (
  word_id TEXT NOT NULL REFERENCES words (id),
  position INTEGER NOT NULL,
  PRIMARY KEY (word_id, position)
) WITHOUT ROWID;

-- Position 0 is the primary Definition, the rest are extra Definitions.
CREATE TABLE definitions (
  word_id TEXT NOT NULL REFERENCES words (id),
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (word_id, position)
) WITHOUT ROWID;

CREATE TABLE examples (
  word_id TEXT NOT NULL REFERENCES words (id),
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  author TEXT,
  PRIMARY KEY (word_id, position)
) WITHOUT ROWID;

-- Synonyms and antonyms.
CREATE TABLE related_words (
  word_id TEXT NOT NULL REFERENCES words (id),
  relation TEXT NOT NULL CHECK (relation IN ('synonym', 'antonym')),
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (word_id, relation, position)
) WITHOUT ROWID;

CREATE TABLE word_registers (
  word_id TEXT NOT NULL REFERENCES words (id),
  position INTEGER NOT NULL,
  register TEXT NOT NULL,
  PRIMARY KEY (word_id, position)
) WITHOUT ROWID;

CREATE TABLE corrections (
  id TEXT PRIMARY KEY REFERENCES entries (id),
  non_standard_form TEXT NOT NULL,
  correction_type TEXT NOT NULL,
  explanation TEXT NOT NULL,
  example_non_standard TEXT NOT NULL,
  example_standard TEXT NOT NULL,
  retired INTEGER NOT NULL
) WITHOUT ROWID;

-- Position 0 is the main standard equivalent.
CREATE TABLE correction_equivalents (
  correction_id TEXT NOT NULL REFERENCES corrections (id),
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (correction_id, position)
) WITHOUT ROWID;

-- A Word links the Corrections it is the standard form for.
CREATE TABLE word_corrections (
  word_id TEXT NOT NULL REFERENCES words (id),
  position INTEGER NOT NULL,
  correction_id TEXT NOT NULL REFERENCES corrections (id),
  PRIMARY KEY (word_id, position)
) WITHOUT ROWID;

CREATE INDEX word_corrections_by_correction ON word_corrections (correction_id, word_id);

-- Keyed by Entry id, so every kind of Entry records its sources here.
CREATE TABLE sources (
  entry_id TEXT NOT NULL REFERENCES entries (id),
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  archived_url TEXT,
  PRIMARY KEY (entry_id, position)
) WITHOUT ROWID;
`;

/**
 * Where each field of the pack metadata lies in the `metadata` table, and how
 * its text reads back. The field `contentChecksum` keeps the key `checksum`
 * of packs built before it was renamed, so the layout stays as it was.
 */
const METADATA_FIELDS = {
  editionId: { key: 'edition_id', read: String },
  contentVersion: { key: 'content_version', read: Number },
  contentChecksum: { key: 'checksum', read: String },
} as const satisfies Record<keyof PackMetadata, { key: string; read: (text: string) => unknown }>;

/** One row of the `metadata` table. */
export interface MetadataRow {
  readonly key: string;
  readonly value: string;
}

/** The rows of the `metadata` table that record the metadata. */
export function metadataRows(metadata: PackMetadata): MetadataRow[] {
  return Object.entries(METADATA_FIELDS).map(([field, { key }]) => ({
    key,
    value: String(metadata[field as keyof PackMetadata]),
  }));
}

/** The metadata the rows record. Throws when a key is missing or a value is invalid. */
export function metadataOf(rows: readonly MetadataRow[]): PackMetadata {
  const values = new Map(rows.map(({ key, value }) => [key, value]));
  const fields = Object.entries(METADATA_FIELDS).map(([field, { key, read }]) => {
    const text = values.get(key);
    return [field, text === undefined ? undefined : read(text)];
  });
  return PackMetadataSchema.parse(Object.fromEntries(fields));
}

/** Everything that goes into a pack, already validated and sorted. */
export interface PackContent {
  readonly editionId: string;
  readonly contentVersion: number;
  readonly categories: readonly Category[];
  readonly words: readonly Word[];
  readonly corrections: readonly Correction[];
}
