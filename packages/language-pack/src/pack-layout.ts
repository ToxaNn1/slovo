import type { Category, Word } from '@slovo/contracts';

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

CREATE TABLE words (
  id TEXT PRIMARY KEY,
  lemma TEXT NOT NULL,
  part_of_speech TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories (id)
) WITHOUT ROWID;

CREATE TABLE word_stress (
  word_id TEXT NOT NULL REFERENCES words (id),
  position INTEGER NOT NULL,
  PRIMARY KEY (word_id, position)
) WITHOUT ROWID;

-- Position 0 is the primary Definition.
CREATE TABLE definitions (
  word_id TEXT NOT NULL REFERENCES words (id),
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (word_id, position)
) WITHOUT ROWID;
`;

/** Identifies a compiled Language Pack. */
export interface PackMetadata {
  readonly editionId: string;
  readonly contentVersion: number;
  /** `sha256:` followed by the hex digest of the canonical content. */
  readonly checksum: string;
}

/** Everything that goes into a pack, already validated and sorted. */
export interface PackContent {
  readonly editionId: string;
  readonly contentVersion: number;
  readonly categories: readonly Category[];
  readonly words: readonly Word[];
}
