import { PartOfSpeechSchema, type Word } from '@slovo/contracts';
import type { ContentReadPort } from '@slovo/core';

/** A value bound to a `?` placeholder. */
type BindValue = string | number;

/**
 * The slice of an asynchronous SQLite driver the reader needs. expo-sqlite's
 * database matches it as is; other drivers need a thin wrapper.
 */
export interface PackDatabase {
  getAllAsync<T>(sql: string, params: BindValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: BindValue[]): Promise<T | null>;
}

interface WordRow {
  id: string;
  lemma: string;
  part_of_speech: string;
  category_id: string;
  primary_definition: string;
}

const SELECT_IDS = 'SELECT id FROM words ORDER BY id';
const SELECT_WORD = `
  SELECT w.id, w.lemma, w.part_of_speech, w.category_id, d.text AS primary_definition
  FROM words w
  JOIN definitions d ON d.word_id = w.id AND d.position = 0
  WHERE w.id = ?
`;
const SELECT_STRESS = 'SELECT position FROM word_stress WHERE word_id = ? ORDER BY position';

/**
 * Reads a compiled Language Pack through any SQLite driver, so the pack's
 * layout stays known to this package only. Free of Node APIs, so the mobile
 * shell can bundle it.
 */
export function createPackReader(db: PackDatabase): ContentReadPort {
  return {
    async listWordIds() {
      const rows = await db.getAllAsync<{ id: string }>(SELECT_IDS, []);
      return rows.map((row) => row.id);
    },
    async getWord(id): Promise<Word | undefined> {
      const row = await db.getFirstAsync<WordRow>(SELECT_WORD, [id]);
      if (row === null) return undefined;
      const stress = await db.getAllAsync<{ position: number }>(SELECT_STRESS, [id]);
      return {
        id: row.id,
        lemma: row.lemma,
        stress: stress.map((r) => r.position),
        partOfSpeech: PartOfSpeechSchema.parse(row.part_of_speech),
        primaryDefinition: row.primary_definition,
        categoryId: row.category_id,
      };
    },
  };
}
