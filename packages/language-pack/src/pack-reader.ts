import {
  CategorySchema,
  CorrectionSchema,
  CrosswordDaySchema,
  IdiomSchema,
  SynonymRowSchema,
  TipSchema,
  WordSchema,
  type Correction,
  type CrosswordDay,
  type Entry,
  type EntryKind,
  type Idiom,
  type LiteraryUse,
  type PackMetadata,
  type Source,
  type SynonymRow,
  type Tip,
  type Word,
} from '@slovo/contracts';
import type { ContentReadPort } from '@slovo/core';

import { metadataOf, type MetadataRow } from './pack-layout';

/** The pack format this reader reads, the one this package builds; the app asks for Content updates of it. */
export { PACK_FORMAT } from './pack-layout';

/** A value bound to a `?` placeholder. */
type BindValue = string | number;

/**
 * The slice of an asynchronous SQLite driver the reader needs. expo-sqlite's
 * database matches it as is; other drivers, such as `node:sqlite`, need a thin
 * wrapper.
 */
export interface PackDatabase {
  getAllAsync<T>(sql: string, params: BindValue[]): Promise<T[]>;
}

/** The Core's read port over a compiled Language Pack, plus the pack's metadata. */
export interface PackReader extends ContentReadPort {
  /** Throws when the pack's metadata misses a field or holds an invalid one. */
  metadata(): Promise<PackMetadata>;
  /** The Daily Crossword of a date, `YYYY-MM-DD`, or undefined when the pack has no such day. */
  crosswordDay(date: string): Promise<CrosswordDay | undefined>;
}

interface CrosswordWordRow {
  entry_id: string;
  answer: string;
  clue: string;
  start_row: number;
  start_column: number;
  direction: string;
}

interface WordRow {
  id: string;
  lemma: string;
  part_of_speech: string;
  gender: string | null;
  category_id: string;
  rarity: number;
  etymology: string | null;
  region: string | null;
  history: string | null;
  origin: string | null;
  illustration: string | null;
  retired: number;
}

interface CorrectionRow {
  id: string;
  non_standard_form: string;
  correction_type: string;
  explanation: string;
  example_non_standard: string;
  example_standard: string;
  category_id: string;
  retired: number;
}

interface LiteraryUseRow {
  text: string;
  author: string;
  work: string;
  author_death_year: number;
  work_year: number | null;
  url: string | null;
}

interface IdiomRow {
  id: string;
  expression: string;
  idiom_type: string;
  etymology: string | null;
  retired: number;
}

interface SynonymRowRow {
  id: string;
  dominant: string;
  dominant_word_id: string | null;
  meaning: string;
  example_text: string | null;
  example_author: string | null;
  retired: number;
}

interface RowMemberRow {
  text: string;
  word_id: string | null;
  shade_note: string | null;
}

interface TipRow {
  id: string;
  title: string;
  non_standard_form: string | null;
  standard_form: string;
  explanation: string;
  example_text: string | null;
  example_author: string | null;
  question_prompt: string;
  right_answer: string;
  retired: number;
}

interface SourceRow {
  title: string;
  short_name: string | null;
  url: string | null;
  archived_url: string | null;
}

const SQL = {
  categories: 'SELECT id, display_name FROM categories ORDER BY position',
  correctionCategories: 'SELECT id, display_name FROM correction_categories ORDER BY position',
  wordIds: 'SELECT id FROM words WHERE retired = 0 ORDER BY id',
  wordIdsInCategory: 'SELECT id FROM words WHERE retired = 0 AND category_id = ? ORDER BY id',
  correctionIds: 'SELECT id FROM corrections WHERE retired = 0 ORDER BY id',
  idiomIds: 'SELECT id FROM idioms WHERE retired = 0 ORDER BY id',
  synonymRowIds: 'SELECT id FROM synonym_rows WHERE retired = 0 ORDER BY id',
  tipIds: 'SELECT id FROM tips WHERE retired = 0 ORDER BY id',
  entryKinds: (list: string) => `SELECT id, kind FROM entries WHERE id IN ${list}`,
  linkedWordIds: `
    SELECT words.id FROM word_corrections JOIN words ON words.id = word_corrections.word_id
    WHERE word_corrections.correction_id = ? AND words.retired = 0
    ORDER BY words.id
  `,
  linkingSynonymRowIds: `
    SELECT DISTINCT synonym_rows.id FROM synonym_row_members
    JOIN synonym_rows ON synonym_rows.id = synonym_row_members.row_id
    JOIN words ON words.id = synonym_row_members.word_id
    WHERE synonym_row_members.word_id = ? AND synonym_rows.retired = 0 AND words.retired = 0
    ORDER BY synonym_rows.id
  `,
  metadata: 'SELECT key, value FROM metadata',
  crosswordDay:
    'SELECT entry_id, answer, clue, start_row, start_column, direction FROM crossword_words WHERE date = ? ORDER BY position',
};

/** Which Words a read takes: a condition on the `words` table and the values it binds. */
interface WordFilter {
  readonly where: string;
  readonly params: BindValue[];
}

const liveWords: WordFilter = { where: 'retired = 0', params: [] };

/** The ids a read of many Entries binds at most, well under SQLite's limit of bound values. */
const IDS_PER_READ = 500;

/** The ids in parts of at most `IDS_PER_READ`, each with the list of placeholders that binds it. */
function inParts(ids: readonly string[]): { readonly list: string; readonly params: string[] }[] {
  const parts = [];
  for (let first = 0; first < ids.length; first += IDS_PER_READ) {
    const params = ids.slice(first, first + IDS_PER_READ);
    parts.push({ list: `(${params.map(() => '?').join(', ')})`, params });
  }
  return parts;
}

/** The parts of the Corrections of the ids, each row with the id of its Correction. */
const correctionParts = (list: string) => ({
  corrections: `SELECT * FROM corrections WHERE id IN ${list} ORDER BY id`,
  equivalents: `SELECT correction_id AS entry_id, text FROM correction_equivalents WHERE correction_id IN ${list} ORDER BY correction_id, position`,
  literaryUses: `SELECT correction_id AS entry_id, text, author, work, author_death_year, work_year, url FROM correction_literary_uses WHERE correction_id IN ${list} ORDER BY correction_id, position`,
  sources: `SELECT entry_id, title, short_name, url, archived_url FROM sources WHERE entry_id IN ${list} ORDER BY entry_id, position`,
});

/** The parts of the Idioms of the ids, each row with the id of its Idiom. */
const idiomParts = (list: string) => ({
  idioms: `SELECT * FROM idioms WHERE id IN ${list} ORDER BY id`,
  definitions: `SELECT idiom_id AS entry_id, text FROM idiom_definitions WHERE idiom_id IN ${list} ORDER BY idiom_id, position`,
  examples: `SELECT idiom_id AS entry_id, text, author FROM idiom_examples WHERE idiom_id IN ${list} ORDER BY idiom_id, position`,
  sources: `SELECT entry_id, title, short_name, url, archived_url FROM sources WHERE entry_id IN ${list} ORDER BY entry_id, position`,
});

/**
 * The parts of the Synonym Rows of the ids, each row with the id of its
 * Synonym Row. A link to a Word reads back only while the Word is live, so a
 * Word Retired later leaves its dominant or member as plain text (ADR 0051).
 */
const synonymRowParts = (list: string) => ({
  rows: `
    SELECT synonym_rows.id, dominant, words.id AS dominant_word_id, meaning, example_text,
      example_author, synonym_rows.retired
    FROM synonym_rows
    LEFT JOIN words ON words.id = synonym_rows.dominant_word_id AND words.retired = 0
    WHERE synonym_rows.id IN ${list} ORDER BY synonym_rows.id
  `,
  members: `
    SELECT row_id AS entry_id, text, words.id AS word_id, shade_note
    FROM synonym_row_members
    LEFT JOIN words ON words.id = synonym_row_members.word_id AND words.retired = 0
    WHERE row_id IN ${list} ORDER BY row_id, position
  `,
  stress: `SELECT row_id AS entry_id, member, position FROM synonym_row_stress WHERE row_id IN ${list} ORDER BY row_id, member, position`,
  sources: `SELECT entry_id, title, short_name, url, archived_url FROM sources WHERE entry_id IN ${list} ORDER BY entry_id, position`,
});

/** The parts of the Tips of the ids, each row with the id of its Tip. */
const tipParts = (list: string) => ({
  tips: `SELECT id, title, non_standard_form, standard_form, explanation, example_text, example_author, question_prompt, right_answer, retired FROM tips WHERE id IN ${list} ORDER BY id`,
  wrongAnswers: `SELECT tip_id AS entry_id, text FROM tip_wrong_answers WHERE tip_id IN ${list} ORDER BY tip_id, position`,
  sources: `SELECT entry_id, title, short_name, url, archived_url FROM sources WHERE entry_id IN ${list} ORDER BY entry_id, position`,
});

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
    moods: `SELECT word_id, mood FROM word_moods WHERE word_id ${ofTheWords} ORDER BY word_id, position`,
    sources: `SELECT entry_id AS word_id, title, short_name, url, archived_url FROM sources WHERE entry_id ${ofTheWords} ORDER BY entry_id, position`,
    links: `SELECT word_id, correction_id FROM word_corrections WHERE word_id ${ofTheWords} ORDER BY word_id, position`,
  };
};

/** Rows by the id of their Entry, each Entry's in the order they came. */
function grouped<T>(rows: readonly T[], idOf: (row: T) => string): ReadonlyMap<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(idOf(row));
    if (group === undefined) groups.set(idOf(row), [row]);
    else group.push(row);
  }
  return groups;
}

/** Rows by the id of their Word. */
const byWord = <T extends { word_id: string }>(rows: readonly T[]) =>
  grouped(rows, (row) => row.word_id);

/** Rows by the id of their Entry, for the kinds whose parts name it `entry_id`. */
const byEntry = <T extends { entry_id: string }>(rows: readonly T[]) =>
  grouped(rows, (row) => row.entry_id);

const sourceOf = ({ title, short_name, url, archived_url }: SourceRow): Source => ({
  title,
  ...(short_name === null ? {} : { shortName: short_name }),
  ...(url === null ? {} : { url }),
  ...(archived_url === null ? {} : { archivedUrl: archived_url }),
});

const literaryUseOf = (row: LiteraryUseRow): LiteraryUse => ({
  text: row.text,
  author: row.author,
  work: row.work,
  authorDeathYear: row.author_death_year,
  ...(row.work_year === null ? {} : { workYear: row.work_year }),
  ...(row.url === null ? {} : { url: row.url }),
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

  /** The Words the filter takes, in id order, each with all its parts. */
  async function readWords({ where, params }: WordFilter): Promise<Word[]> {
    const sql = wordParts(where);
    type WithWordId<T> = T & { word_id: string };
    const [rows, stress, definitions, examples, related, registers, moods, wordSources, links] =
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
        db.getAllAsync<WithWordId<{ mood: string }>>(sql.moods, params).then(byWord),
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
        ...(row.region === null ? {} : { region: row.region }),
        ...(row.history === null ? {} : { history: row.history }),
        ...(row.origin === null ? {} : { origin: row.origin }),
        ...(row.illustration === null ? {} : { illustration: row.illustration }),
        ...(moods.has(row.id) ? { moods: (moods.get(row.id) ?? []).map((r) => r.mood) } : {}),
        categoryId: row.category_id,
        rarity: row.rarity,
        sources: (wordSources.get(row.id) ?? []).map(sourceOf),
        correctionIds: (links.get(row.id) ?? []).map((r) => r.correction_id),
        retired: row.retired === 1,
      });
    });
  }

  /** The Words of the ids, in id order within each part of `IDS_PER_READ`. */
  async function readWordsOf(ids: readonly string[]): Promise<Word[]> {
    const parts = await Promise.all(
      inParts(ids).map(({ list, params }) => readWords({ where: `id IN ${list}`, params })),
    );
    return parts.flat();
  }

  type WithEntryId<T> = T & { entry_id: string };

  /** The Idioms of the ids, each with all its parts, four queries per `IDS_PER_READ`. */
  async function readIdioms(ids: readonly string[]): Promise<Idiom[]> {
    const parts = await Promise.all(
      inParts(ids).map(async ({ list, params }) => {
        const sql = idiomParts(list);
        const [rows, definitions, examples, idiomSources] = await Promise.all([
          db.getAllAsync<IdiomRow>(sql.idioms, params),
          db.getAllAsync<WithEntryId<{ text: string }>>(sql.definitions, params).then(byEntry),
          db
            .getAllAsync<WithEntryId<{ text: string; author: string | null }>>(sql.examples, params)
            .then(byEntry),
          db.getAllAsync<WithEntryId<SourceRow>>(sql.sources, params).then(byEntry),
        ]);
        return rows.map((row) => {
          const [primaryDefinition, ...extraDefinitions] = (definitions.get(row.id) ?? []).map(
            (r) => r.text,
          );
          // Parsing checks the pack against the contracts and types the Idiom.
          return IdiomSchema.parse({
            id: row.id,
            expression: row.expression,
            idiomType: row.idiom_type,
            primaryDefinition,
            extraDefinitions,
            examples: (examples.get(row.id) ?? []).map(({ text, author }) =>
              author === null ? { text } : { text, author },
            ),
            ...(row.etymology === null ? {} : { etymology: row.etymology }),
            sources: (idiomSources.get(row.id) ?? []).map(sourceOf),
            retired: row.retired === 1,
          });
        });
      }),
    );
    return parts.flat();
  }

  /** The Corrections of the ids, each with all its parts, four queries per `IDS_PER_READ`. */
  async function readCorrections(ids: readonly string[]): Promise<Correction[]> {
    const parts = await Promise.all(
      inParts(ids).map(async ({ list, params }) => {
        const sql = correctionParts(list);
        const [rows, equivalents, literaryUses, correctionSources] = await Promise.all([
          db.getAllAsync<CorrectionRow>(sql.corrections, params),
          db.getAllAsync<WithEntryId<{ text: string }>>(sql.equivalents, params).then(byEntry),
          db.getAllAsync<WithEntryId<LiteraryUseRow>>(sql.literaryUses, params).then(byEntry),
          db.getAllAsync<WithEntryId<SourceRow>>(sql.sources, params).then(byEntry),
        ]);
        return rows.map((row) =>
          // Parsing checks the pack against the contracts and types the Correction.
          CorrectionSchema.parse({
            id: row.id,
            nonStandardForm: row.non_standard_form,
            correctionType: row.correction_type,
            standardEquivalents: (equivalents.get(row.id) ?? []).map((r) => r.text),
            explanation: row.explanation,
            examplePair: { nonStandard: row.example_non_standard, standard: row.example_standard },
            categoryId: row.category_id,
            sources: (correctionSources.get(row.id) ?? []).map(sourceOf),
            literaryUses: (literaryUses.get(row.id) ?? []).map(literaryUseOf),
            retired: row.retired === 1,
          }),
        );
      }),
    );
    return parts.flat();
  }

  /** The Synonym Rows of the ids, each with all its parts, four queries per `IDS_PER_READ`. */
  async function readSynonymRows(ids: readonly string[]): Promise<SynonymRow[]> {
    const parts = await Promise.all(
      inParts(ids).map(async ({ list, params }) => {
        const sql = synonymRowParts(list);
        const [rows, members, stress, rowSources] = await Promise.all([
          db.getAllAsync<SynonymRowRow>(sql.rows, params),
          db.getAllAsync<WithEntryId<RowMemberRow>>(sql.members, params).then(byEntry),
          db
            .getAllAsync<WithEntryId<{ member: number; position: number }>>(sql.stress, params)
            .then(byEntry),
          db.getAllAsync<WithEntryId<SourceRow>>(sql.sources, params).then(byEntry),
        ]);
        return rows.map((row) => {
          const stressOf = (member: number) =>
            (stress.get(row.id) ?? []).filter((r) => r.member === member).map((r) => r.position);
          const linked = (wordId: string | null) => (wordId === null ? {} : { wordId });
          // Parsing checks the pack against the contracts and types the Synonym Row.
          return SynonymRowSchema.parse({
            id: row.id,
            dominant: { text: row.dominant, stress: stressOf(0), ...linked(row.dominant_word_id) },
            meaning: row.meaning,
            members: (members.get(row.id) ?? []).map((member, position) => ({
              text: member.text,
              stress: stressOf(position + 1),
              ...linked(member.word_id),
              ...(member.shade_note === null ? {} : { shadeNote: member.shade_note }),
            })),
            ...(row.example_text === null
              ? {}
              : {
                  example:
                    row.example_author === null
                      ? { text: row.example_text }
                      : { text: row.example_text, author: row.example_author },
                }),
            sources: (rowSources.get(row.id) ?? []).map(sourceOf),
            retired: row.retired === 1,
          });
        });
      }),
    );
    return parts.flat();
  }

  /** The Tips of the ids, each with all its parts, three queries per `IDS_PER_READ`. */
  async function readTips(ids: readonly string[]): Promise<Tip[]> {
    const parts = await Promise.all(
      inParts(ids).map(async ({ list, params }) => {
        const sql = tipParts(list);
        const [tips, wrongAnswers, tipSources] = await Promise.all([
          db.getAllAsync<TipRow>(sql.tips, params),
          db.getAllAsync<WithEntryId<{ text: string }>>(sql.wrongAnswers, params).then(byEntry),
          db.getAllAsync<WithEntryId<SourceRow>>(sql.sources, params).then(byEntry),
        ]);
        // Parsing checks the pack against the contracts and types the Tip.
        return tips.map((tip) =>
          TipSchema.parse({
            id: tip.id,
            title: tip.title,
            ...(tip.non_standard_form === null ? {} : { nonStandardForm: tip.non_standard_form }),
            standardForm: tip.standard_form,
            explanation: tip.explanation,
            ...(tip.example_text === null
              ? {}
              : {
                  example:
                    tip.example_author === null
                      ? { text: tip.example_text }
                      : { text: tip.example_text, author: tip.example_author },
                }),
            sources: (tipSources.get(tip.id) ?? []).map(sourceOf),
            gameQuestion: {
              prompt: tip.question_prompt,
              rightAnswer: tip.right_answer,
              wrongAnswers: (wrongAnswers.get(tip.id) ?? []).map(({ text }) => text),
            },
            retired: tip.retired === 1,
          }),
        );
      }),
    );
    return parts.flat();
  }

  /** How to read the Entries of each kind by id. */
  const readOfKind: Record<EntryKind, (ids: readonly string[]) => Promise<Entry[]>> = {
    word: readWordsOf,
    correction: readCorrections,
    idiom: readIdioms,
    synonymRow: readSynonymRows,
    tip: readTips,
  };

  /**
   * The Entries of the ids, whatever their kind: the `entries` table says
   * each id's kind in one query per `IDS_PER_READ`, then each kind present is
   * read at once.
   */
  async function readEntries(ids: readonly string[]): Promise<Entry[]> {
    const kinds = await Promise.all(
      inParts(ids).map(({ list, params }) =>
        db.getAllAsync<{ id: string; kind: EntryKind }>(SQL.entryKinds(list), params),
      ),
    );
    const idsOfKind = new Map<EntryKind, string[]>();
    for (const { id, kind } of kinds.flat()) {
      const ofKind = idsOfKind.get(kind);
      if (ofKind === undefined) idsOfKind.set(kind, [id]);
      else ofKind.push(id);
    }
    const parts = await Promise.all(
      [...idsOfKind].map(([kind, ofKind]) => readOfKind[kind](ofKind)),
    );
    return parts.flat();
  }

  /** The Categories of one list, in the pack's order. */
  async function readCategories(sql: string) {
    const rows = await db.getAllAsync<{ id: string; display_name: string }>(sql, []);
    // Parsing checks the pack against the contracts and types the Category.
    return rows.map(({ id, display_name }) =>
      CategorySchema.parse({ id, displayName: display_name }),
    );
  }

  return {
    listCategories: () => readCategories(SQL.categories),
    listCorrectionCategories: () => readCategories(SQL.correctionCategories),
    listWordIds: (categoryId) =>
      categoryId === undefined
        ? column(SQL.wordIds, [], 'id')
        : column(SQL.wordIdsInCategory, [categoryId], 'id'),
    listWords: () => readWords(liveWords),
    getEntries: readEntries,
    listCorrectionIds: () => column(SQL.correctionIds, [], 'id'),
    listLinkedWordIds: (correctionId) => column(SQL.linkedWordIds, [correctionId], 'id'),
    listIdiomIds: () => column(SQL.idiomIds, [], 'id'),
    listLinkingSynonymRowIds: (wordId) => column(SQL.linkingSynonymRowIds, [wordId], 'id'),
    listSynonymRowIds: () => column(SQL.synonymRowIds, [], 'id'),
    listTipIds: () => column(SQL.tipIds, [], 'id'),
    metadata: async () => metadataOf(await db.getAllAsync<MetadataRow>(SQL.metadata, [])),
    crosswordDay: async (date) => {
      const rows = await db.getAllAsync<CrosswordWordRow>(SQL.crosswordDay, [date]);
      if (rows.length === 0) return undefined;
      return CrosswordDaySchema.parse({
        date,
        words: rows.map((row) => ({
          entryId: row.entry_id,
          answer: row.answer,
          clue: row.clue,
          row: row.start_row,
          column: row.start_column,
          direction: row.direction,
        })),
      });
    },
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
