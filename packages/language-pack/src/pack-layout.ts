import {
  PackMetadataSchema,
  type Category,
  type Correction,
  type CrosswordDay,
  type Idiom,
  type PackMetadata,
  type SynonymRow,
  type Tip,
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

-- The Categories of Corrections, a list apart from the Words' (ADR 0033).
CREATE TABLE correction_categories (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  position INTEGER NOT NULL
) WITHOUT ROWID;

-- Every Entry, whatever its kind.
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('word', 'correction', 'idiom', 'synonymRow', 'tip'))
) WITHOUT ROWID;

CREATE TABLE words (
  id TEXT PRIMARY KEY REFERENCES entries (id),
  lemma TEXT NOT NULL,
  part_of_speech TEXT NOT NULL,
  gender TEXT,
  category_id TEXT NOT NULL REFERENCES categories (id),
  rarity INTEGER NOT NULL,
  etymology TEXT,
  region TEXT,
  history TEXT,
  origin TEXT,
  illustration TEXT,
  retired INTEGER NOT NULL
) WITHOUT ROWID;

-- The live Words of a Category, read once per Category of the Mix. The primary
-- key id rides along in every entry, so the read never touches the table.
CREATE INDEX words_by_category ON words (category_id, retired);

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

CREATE TABLE word_moods (
  word_id TEXT NOT NULL REFERENCES words (id),
  position INTEGER NOT NULL,
  mood TEXT NOT NULL,
  PRIMARY KEY (word_id, position)
) WITHOUT ROWID;

CREATE TABLE corrections (
  id TEXT PRIMARY KEY REFERENCES entries (id),
  non_standard_form TEXT NOT NULL,
  correction_type TEXT NOT NULL,
  explanation TEXT NOT NULL,
  example_non_standard TEXT NOT NULL,
  example_standard TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES correction_categories (id),
  retired INTEGER NOT NULL
) WITHOUT ROWID;

-- Position 0 is the main standard equivalent.
CREATE TABLE correction_equivalents (
  correction_id TEXT NOT NULL REFERENCES corrections (id),
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (correction_id, position)
) WITHOUT ROWID;

-- Real uses of a Correction's standard form in literature, in the card's order.
CREATE TABLE correction_literary_uses (
  correction_id TEXT NOT NULL REFERENCES corrections (id),
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  author TEXT NOT NULL,
  work TEXT NOT NULL,
  author_death_year INTEGER NOT NULL,
  work_year INTEGER,
  url TEXT,
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

CREATE TABLE idioms (
  id TEXT PRIMARY KEY REFERENCES entries (id),
  expression TEXT NOT NULL,
  idiom_type TEXT NOT NULL,
  etymology TEXT,
  retired INTEGER NOT NULL
) WITHOUT ROWID;

-- Position 0 is the primary Definition, the rest are extra Definitions.
CREATE TABLE idiom_definitions (
  idiom_id TEXT NOT NULL REFERENCES idioms (id),
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (idiom_id, position)
) WITHOUT ROWID;

CREATE TABLE idiom_examples (
  idiom_id TEXT NOT NULL REFERENCES idioms (id),
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  author TEXT,
  PRIMARY KEY (idiom_id, position)
) WITHOUT ROWID;

CREATE TABLE synonym_rows (
  id TEXT PRIMARY KEY REFERENCES entries (id),
  dominant TEXT NOT NULL,
  dominant_word_id TEXT REFERENCES words (id),
  meaning TEXT NOT NULL,
  example_text TEXT,
  example_author TEXT,
  retired INTEGER NOT NULL
) WITHOUT ROWID;

-- The members of a Synonym Row, in the card's order.
CREATE TABLE synonym_row_members (
  row_id TEXT NOT NULL REFERENCES synonym_rows (id),
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  word_id TEXT REFERENCES words (id),
  shade_note TEXT,
  PRIMARY KEY (row_id, position)
) WITHOUT ROWID;

-- The Stress of a Synonym Row's words: member 0 is the dominant, member n
-- the member at position n - 1.
CREATE TABLE synonym_row_stress (
  row_id TEXT NOT NULL REFERENCES synonym_rows (id),
  member INTEGER NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (row_id, member, position)
) WITHOUT ROWID;

CREATE TABLE tips (
  id TEXT PRIMARY KEY REFERENCES entries (id),
  title TEXT NOT NULL,
  non_standard_form TEXT,
  standard_form TEXT NOT NULL,
  explanation TEXT NOT NULL,
  example_text TEXT,
  example_author TEXT,
  question_prompt TEXT NOT NULL,
  right_answer TEXT NOT NULL,
  retired INTEGER NOT NULL
) WITHOUT ROWID;

-- The wrong answers of a Tip's Game question, in order.
CREATE TABLE tip_wrong_answers (
  tip_id TEXT NOT NULL REFERENCES tips (id),
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (tip_id, position)
) WITHOUT ROWID;

-- The Daily Crossword, a row per word of a day (ADR 0052). A day keeps the
-- answer and clue it was made with, so a later edit of its Entry never changes it.
CREATE TABLE crossword_words (
  date TEXT NOT NULL,
  position INTEGER NOT NULL,
  entry_id TEXT NOT NULL REFERENCES entries (id),
  answer TEXT NOT NULL,
  clue TEXT NOT NULL,
  start_row INTEGER NOT NULL,
  start_column INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('across', 'down')),
  PRIMARY KEY (date, position)
) WITHOUT ROWID;

-- Keyed by Entry id, so every kind of Entry records its sources here.
CREATE TABLE sources (
  entry_id TEXT NOT NULL REFERENCES entries (id),
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  short_name TEXT,
  url TEXT,
  archived_url TEXT,
  PRIMARY KEY (entry_id, position)
) WITHOUT ROWID;
`;

/**
 * The pack format this package builds: the number of the SQLite layout above.
 * It rises only when the layout changes in a way an older app can't read (a
 * table or column it reads removed, renamed or given another meaning, or a
 * new value of a closed set in the contracts, which its contract check
 * refuses); content changes and additions it ignores never raise it. Format 2
 * keeps format 1's layout and admits the Correction Types of 0.8.7; format 3
 * keeps it too, adding only the Idiom tables (`idioms`, `idiom_definitions`
 * and `idiom_examples`), the kind `'idiom'` and the Word's region column, and
 * admits the Idioms and the Word's region of 0.8.8; format 4 keeps format 3's
 * layout and admits what 0.8.10 adds to the closed sets and fields, such as
 * the table `correction_categories`, the Correction's category column, the
 * Word's history column and the table `correction_literary_uses`; format 5
 * keeps format 4's layout, adding only the Synonym Row tables
 * (`synonym_rows`, `synonym_row_members` and `synonym_row_stress`), the Tip
 * tables (`tips` and `tip_wrong_answers`) and the kinds `'synonymRow'` and
 * `'tip'`, and admits the Synonym Rows and Tips of 0.8.11 (ADR 0051); format 6
 * keeps format 5's layout, adding only the Word's origin column and the table
 * `crossword_words`, and admits the Word's origin and the Daily Crossword of
 * 0.8.12 (ADR 0052); format 7 keeps format 6's layout, adding only the table
 * `word_moods`, and admits the Word's moods of 0.8.13 (ADR 0054); format 8
 * keeps format 7's layout, adding only the Word's illustration column, and
 * admits the Word's Illustration of 0.8.14 (ADR 0055); format 9 keeps format
 * 8's layout, adding only the source's short name column, and admits the
 * short names of the «Джерело:» line (ADR 0032).
 */
export const PACK_FORMAT = 9;

/**
 * Where each field of the pack metadata lies in the `metadata` table, and how
 * its text reads back. The field `contentChecksum` keeps the key `checksum`
 * of packs built before it was renamed, so the layout stays as it was.
 */
const METADATA_FIELDS = {
  editionId: { key: 'edition_id', read: String },
  contentVersion: { key: 'content_version', read: Number },
  contentChecksum: { key: 'checksum', read: String },
  packFormat: { key: 'pack_format', read: Number },
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
  readonly correctionCategories: readonly Category[];
  readonly words: readonly Word[];
  readonly corrections: readonly Correction[];
  readonly idioms: readonly Idiom[];
  readonly synonymRows: readonly SynonymRow[];
  readonly tips: readonly Tip[];
  /**
   * The days of the Daily Crossword, in date order; unset when the Edition
   * keeps none, so the content checksum of an Edition without days stays as
   * it was.
   */
  readonly crosswordDays?: readonly CrosswordDay[];
}
