import {
  CategorySchema,
  CorrectionSchema,
  WordSchema,
  type Correction,
  type PackMetadata,
  type Source,
  type Word,
} from '@slovo/contracts';
import type { ContentReadPort } from '@slovo/core';

import { metadataOf, type MetadataRow } from './pack-layout';

/** A value bound to a `?` placeholder. */
type BindValue = string | number;

/**
 * The slice of an asynchronous SQLite driver the reader needs. expo-sqlite's
 * database matches it as is; other drivers, such as `node:sqlite`, need a thin
 * wrapper.
 */
export interface PackDatabase {
  getAllAsync<T>(sql: string, params: BindValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: BindValue[]): Promise<T | null>;
}

/** The Core's read port over a compiled Language Pack, plus the pack's metadata. */
export interface PackReader extends ContentReadPort {
  /** Throws when the pack's metadata misses a field or holds an invalid one. */
  metadata(): Promise<PackMetadata>;
}

interface WordRow {
  id: string;
  lemma: string;
  part_of_speech: string;
  gender: string | null;
  category_id: string;
  rarity: number;
  etymology: string | null;
  retired: number;
}

interface CorrectionRow {
  id: string;
  non_standard_form: string;
  correction_type: string;
  explanation: string;
  example_non_standard: string;
  example_standard: string;
  retired: number;
}

interface SourceRow {
  title: string;
  url: string | null;
  archived_url: string | null;
}

const SQL = {
  categories: 'SELECT id, display_name FROM categories ORDER BY position',
  wordIds: 'SELECT id FROM words WHERE retired = 0 ORDER BY id',
  wordIdsInCategory: 'SELECT id FROM words WHERE retired = 0 AND category_id = ? ORDER BY id',
  sources: 'SELECT title, url, archived_url FROM sources WHERE entry_id = ? ORDER BY position',
  correctionIds: 'SELECT id FROM corrections WHERE retired = 0 ORDER BY id',
  correction: 'SELECT * FROM corrections WHERE id = ?',
  equivalents: 'SELECT text FROM correction_equivalents WHERE correction_id = ? ORDER BY position',
  linkedWordIds: `
    SELECT words.id FROM word_corrections JOIN words ON words.id = word_corrections.word_id
    WHERE word_corrections.correction_id = ? AND words.retired = 0
    ORDER BY words.id
  `,
  metadata: 'SELECT key, value FROM metadata',
};

/** Which Words a read takes: a condition on the `words` table and the values it binds. */
interface WordFilter {
  readonly where: string;
  readonly params: BindValue[];
}

const oneWord = (id: string): WordFilter => ({ where: 'id = ?', params: [id] });
const liveWords: WordFilter = { where: 'retired = 0', params: [] };

/**
 * The tables that hold the parts of a Word, each row with the id of its Word,
 * read for every Word the filter takes in one query per table.
 */
const wordParts = (where: string) => {
  const ofTheWords = `IN (SELECT id FROM words WHERE ${where})`;
  return {
    words: `SELECT * FROM words WHERE ${where} ORDER BY id`,
    stress: `SELECT word_id, position FROM word_stress WHERE word_id ${ofTheWords} ORDER BY word_id, position`,
    definitions: `SELECT word_id, text FROM definitions WHERE word_id ${ofTheWords} ORDER BY word_id, position`,
    examples: `SELECT word_id, text, author FROM examples WHERE word_id ${ofTheWords} ORDER BY word_id, position`,
    relatedWords: `SELECT word_id, relation, text FROM related_words WHERE word_id ${ofTheWords} ORDER BY word_id, relation, position`,
    registers: `SELECT word_id, register FROM word_registers WHERE word_id ${ofTheWords} ORDER BY word_id, position`,
    sources: `SELECT entry_id AS word_id, title, url, archived_url FROM sources WHERE entry_id ${ofTheWords} ORDER BY entry_id, position`,
    links: `SELECT word_id, correction_id FROM word_corrections WHERE word_id ${ofTheWords} ORDER BY word_id, position`,
  };
};

/** Rows by the id of their Word, each Word's in the order they came. */
function byWord<T extends { word_id: string }>(rows: readonly T[]): ReadonlyMap<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const group = grouped.get(row.word_id);
    if (group === undefined) grouped.set(row.word_id, [row]);
    else group.push(row);
  }
  return grouped;
}

const sourceOf = ({ title, url, archived_url }: SourceRow): Source => ({
  title,
  ...(url === null ? {} : { url }),
  ...(archived_url === null ? {} : { archivedUrl: archived_url }),
});

/**
 * Reads a compiled Language Pack through any SQLite driver. This is the only
 * code that reads the pack layout: the Node reader and the mobile shell both
 * go through it. Free of Node APIs, so the mobile shell can bundle it.
 */
export function createPackReader(db: PackDatabase): PackReader {
  /** One text column of every matching row. */
  async function column(sql: string, params: BindValue[], name: string): Promise<string[]> {
    const rows = await db.getAllAsync<Record<string, string>>(sql, params);
    return rows.map((row) => String(row[name]));
  }

  async function sources(entryId: string): Promise<Source[]> {
    const rows = await db.getAllAsync<SourceRow>(SQL.sources, [entryId]);
    return rows.map(sourceOf);
  }

  /** The Words the filter takes, in id order, each with all its parts. */
  async function readWords({ where, params }: WordFilter): Promise<Word[]> {
    const sql = wordParts(where);
    type WithWordId<T> = T & { word_id: string };
    const [rows, stress, definitions, examples, related, registers, wordSources, links] =
      await Promise.all([
        db.getAllAsync<WordRow>(sql.words, params),
        db.getAllAsync<WithWordId<{ position: number }>>(sql.stress, params).then(byWord),
        db.getAllAsync<WithWordId<{ text: string }>>(sql.definitions, params).then(byWord),
        db
          .getAllAsync<WithWordId<{ text: string; author: string | null }>>(sql.examples, params)
          .then(byWord),
        db
          .getAllAsync<WithWordId<{ relation: string; text: string }>>(sql.relatedWords, params)
          .then(byWord),
        db.getAllAsync<WithWordId<{ register: string }>>(sql.registers, params).then(byWord),
        db.getAllAsync<WithWordId<SourceRow>>(sql.sources, params).then(byWord),
        db.getAllAsync<WithWordId<{ correction_id: string }>>(sql.links, params).then(byWord),
      ]);
    return rows.map((row) => {
      const relatedOf = (relation: string) =>
        (related.get(row.id) ?? []).filter((r) => r.relation === relation).map((r) => r.text);
      const [primaryDefinition, ...extraDefinitions] = (definitions.get(row.id) ?? []).map(
        (r) => r.text,
      );
      // Parsing checks the pack against the contracts and types the Word.
      return WordSchema.parse({
        id: row.id,
        lemma: row.lemma,
        stress: (stress.get(row.id) ?? []).map((r) => r.position),
        partOfSpeech: row.part_of_speech,
        ...(row.gender === null ? {} : { gender: row.gender }),
        primaryDefinition,
        extraDefinitions,
        examples: (examples.get(row.id) ?? []).map(({ text, author }) =>
          author === null ? { text } : { text, author },
        ),
        synonyms: relatedOf('synonym'),
        antonyms: relatedOf('antonym'),
        ...(row.etymology === null ? {} : { etymology: row.etymology }),
        registers: (registers.get(row.id) ?? []).map((r) => r.register),
        categoryId: row.category_id,
        rarity: row.rarity,
        sources: (wordSources.get(row.id) ?? []).map(sourceOf),
        correctionIds: (links.get(row.id) ?? []).map((r) => r.correction_id),
        retired: row.retired === 1,
      });
    });
  }

  async function getCorrection(id: string): Promise<Correction | undefined> {
    const row = await db.getFirstAsync<CorrectionRow>(SQL.correction, [id]);
    if (row === null) return undefined;
    const [standardEquivalents, correctionSources] = await Promise.all([
      column(SQL.equivalents, [id], 'text'),
      sources(id),
    ]);
    // Parsing checks the pack against the contracts and types the Correction.
    return CorrectionSchema.parse({
      id: row.id,
      nonStandardForm: row.non_standard_form,
      correctionType: row.correction_type,
      standardEquivalents,
      explanation: row.explanation,
      examplePair: { nonStandard: row.example_non_standard, standard: row.example_standard },
      sources: correctionSources,
      retired: row.retired === 1,
    });
  }

  return {
    async listCategories() {
      const rows = await db.getAllAsync<{ id: string; display_name: string }>(SQL.categories, []);
      // Parsing checks the pack against the contracts and types the Category.
      return rows.map(({ id, display_name }) =>
        CategorySchema.parse({ id, displayName: display_name }),
      );
    },
    listWordIds: (categoryId) =>
      categoryId === undefined
        ? column(SQL.wordIds, [], 'id')
        : column(SQL.wordIdsInCategory, [categoryId], 'id'),
    listWords: () => readWords(liveWords),
    getWord: async (id) => (await readWords(oneWord(id)))[0],
    listCorrectionIds: () => column(SQL.correctionIds, [], 'id'),
    getCorrection,
    listLinkedWordIds: (correctionId) => column(SQL.linkedWordIds, [correctionId], 'id'),
    metadata: async () => metadataOf(await db.getAllAsync<MetadataRow>(SQL.metadata, [])),
  };
}

/** The Edition each part of the running app says it belongs to. */
export interface AppEditions {
  /** The Edition whose config and strings the JavaScript bundle was built with. */
  readonly bundle: string;
  /**
   * The Edition in the native app's config. Absent when the build does not
   * report one; the other two are still compared.
   */
  readonly native: string | undefined;
}

export type PackOpening =
  | { readonly ok: true; readonly reader: PackReader; readonly metadata: PackMetadata }
  | { readonly ok: false; readonly reason: string };

/**
 * Opens a compiled Language Pack for the running app, with the metadata it
 * read. It refuses when the native app, the JavaScript bundle and the pack
 * are not all of one Edition, e.g. a development client built for one Edition
 * that Metro serves another to, and throws when the pack's metadata is broken.
 */
export async function openPack(db: PackDatabase, app: AppEditions): Promise<PackOpening> {
  const reader = createPackReader(db);
  const metadata = await reader.metadata();
  const { editionId } = metadata;
  const { bundle, native } = app;
  if ([native, editionId].every((id) => id === undefined || id === bundle)) {
    return { ok: true, reader, metadata };
  }
  const nativeDescription = native === undefined ? 'not reported' : `"${native}"`;
  return {
    ok: false,
    reason: `The app mixes Editions (native app: ${nativeDescription}, JavaScript bundle: "${bundle}", Language Pack: "${editionId}"). Rebuild the Language Pack and the native app for one Edition.`,
  };
}
