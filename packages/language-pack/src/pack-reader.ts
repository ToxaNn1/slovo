import {
  CorrectionSchema,
  WordSchema,
  type Correction,
  type Source,
  type Word,
} from '@slovo/contracts';
import type { ContentReadPort } from '@slovo/core';

import type { PackMetadata } from './pack-layout';

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
  wordIds: 'SELECT id FROM words WHERE retired = 0 ORDER BY id',
  wordIdsInCategory: 'SELECT id FROM words WHERE retired = 0 AND category_id = ? ORDER BY id',
  word: 'SELECT * FROM words WHERE id = ?',
  stress: 'SELECT position FROM word_stress WHERE word_id = ? ORDER BY position',
  definitions: 'SELECT text FROM definitions WHERE word_id = ? ORDER BY position',
  examples: 'SELECT text, author FROM examples WHERE word_id = ? ORDER BY position',
  relatedWords:
    'SELECT text FROM related_words WHERE word_id = ? AND relation = ? ORDER BY position',
  registers: 'SELECT register FROM word_registers WHERE word_id = ? ORDER BY position',
  sources: 'SELECT title, url, archived_url FROM sources WHERE entry_id = ? ORDER BY position',
  linkedCorrectionIds:
    'SELECT correction_id FROM word_corrections WHERE word_id = ? ORDER BY position',
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
    return rows.map(({ title, url, archived_url }) => ({
      title,
      ...(url === null ? {} : { url }),
      ...(archived_url === null ? {} : { archivedUrl: archived_url }),
    }));
  }

  async function getWord(id: string): Promise<Word | undefined> {
    const row = await db.getFirstAsync<WordRow>(SQL.word, [id]);
    if (row === null) return undefined;
    const [stress, definitions, examples, synonyms, antonyms, registers, wordSources, links] =
      await Promise.all([
        db.getAllAsync<{ position: number }>(SQL.stress, [id]),
        column(SQL.definitions, [id], 'text'),
        db.getAllAsync<{ text: string; author: string | null }>(SQL.examples, [id]),
        column(SQL.relatedWords, [id, 'synonym'], 'text'),
        column(SQL.relatedWords, [id, 'antonym'], 'text'),
        column(SQL.registers, [id], 'register'),
        sources(id),
        column(SQL.linkedCorrectionIds, [id], 'correction_id'),
      ]);
    const [primaryDefinition, ...extraDefinitions] = definitions;
    // Parsing checks the pack against the contracts and types the Word.
    return WordSchema.parse({
      id: row.id,
      lemma: row.lemma,
      stress: stress.map((r) => r.position),
      partOfSpeech: row.part_of_speech,
      ...(row.gender === null ? {} : { gender: row.gender }),
      primaryDefinition,
      extraDefinitions,
      examples: examples.map(({ text, author }) => (author === null ? { text } : { text, author })),
      synonyms,
      antonyms,
      ...(row.etymology === null ? {} : { etymology: row.etymology }),
      registers,
      categoryId: row.category_id,
      rarity: row.rarity,
      sources: wordSources,
      correctionIds: links,
      retired: row.retired === 1,
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
    listWordIds: (categoryId) =>
      categoryId === undefined
        ? column(SQL.wordIds, [], 'id')
        : column(SQL.wordIdsInCategory, [categoryId], 'id'),
    getWord,
    listCorrectionIds: () => column(SQL.correctionIds, [], 'id'),
    getCorrection,
    listLinkedWordIds: (correctionId) => column(SQL.linkedWordIds, [correctionId], 'id'),
    async metadata() {
      const rows = await db.getAllAsync<{ key: string; value: string }>(SQL.metadata, []);
      const values = new Map(rows.map((r) => [r.key, r.value]));
      return {
        editionId: values.get('edition_id') ?? '',
        contentVersion: Number(values.get('content_version')),
        checksum: values.get('checksum') ?? '',
      };
    },
  };
}
