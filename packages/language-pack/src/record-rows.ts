import type {
  Correction,
  CrosswordDay,
  CuratedCollection,
  Entry,
  Idiom,
  SynonymRow,
  Tip,
  Word,
} from '@slovo/contracts';

/** A value SQLite binds to a `?`. */
export type BindValue = string | number | null;

/** One SQL statement with the values of its `?`s. */
export interface Statement {
  readonly sql: string;
  readonly params: readonly BindValue[];
}

/**
 * The SQL that writes each content record of a pack, the one copy both the
 * build (`writePack`) and a Patch (`applyPatch`) run. A record's own row is
 * an upsert, so a Patch replaces it in place; its child rows are plain
 * inserts, which a Patch runs after `childDeletes` removed the old ones.
 */
const SQL = {
  entry:
    'INSERT INTO entries (id, kind) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET kind = excluded.kind',
  // A Patch leaves `needs_new_recording` as the pack has it: a Patch carries no such flag.
  word: `
    INSERT INTO words (id, lemma, part_of_speech, gender, category_id, rarity, etymology, region, history, origin, illustration, retired, needs_new_recording)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      lemma = excluded.lemma, part_of_speech = excluded.part_of_speech, gender = excluded.gender,
      category_id = excluded.category_id, rarity = excluded.rarity, etymology = excluded.etymology,
      region = excluded.region, history = excluded.history, origin = excluded.origin,
      illustration = excluded.illustration, retired = excluded.retired
  `,
  stress: 'INSERT INTO word_stress (word_id, position) VALUES (?, ?)',
  definition: 'INSERT INTO definitions (word_id, position, text) VALUES (?, ?, ?)',
  example: 'INSERT INTO examples (word_id, position, text, author) VALUES (?, ?, ?, ?)',
  relatedWord: 'INSERT INTO related_words (word_id, relation, position, text) VALUES (?, ?, ?, ?)',
  register: 'INSERT INTO word_registers (word_id, position, register) VALUES (?, ?, ?)',
  correctionLink:
    'INSERT INTO word_corrections (word_id, position, correction_id) VALUES (?, ?, ?)',
  source:
    'INSERT INTO sources (entry_id, position, title, short_name, url, archived_url) VALUES (?, ?, ?, ?, ?, ?)',
  correction: `
    INSERT INTO corrections (
      id, non_standard_form, correction_type, explanation, example_non_standard, example_standard,
      category_id, retired
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      non_standard_form = excluded.non_standard_form, correction_type = excluded.correction_type,
      explanation = excluded.explanation, example_non_standard = excluded.example_non_standard,
      example_standard = excluded.example_standard, category_id = excluded.category_id,
      retired = excluded.retired
  `,
  equivalent: 'INSERT INTO correction_equivalents (correction_id, position, text) VALUES (?, ?, ?)',
  literaryUse: `
    INSERT INTO correction_literary_uses (
      correction_id, position, text, author, work, author_death_year, work_year, url
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  idiom: `
    INSERT INTO idioms (id, expression, idiom_type, etymology, retired)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      expression = excluded.expression, idiom_type = excluded.idiom_type,
      etymology = excluded.etymology, retired = excluded.retired
  `,
  idiomDefinition: 'INSERT INTO idiom_definitions (idiom_id, position, text) VALUES (?, ?, ?)',
  idiomExample: 'INSERT INTO idiom_examples (idiom_id, position, text, author) VALUES (?, ?, ?, ?)',
  row: `
    INSERT INTO synonym_rows (
      id, dominant, dominant_word_id, meaning, example_text, example_author, retired
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      dominant = excluded.dominant, dominant_word_id = excluded.dominant_word_id,
      meaning = excluded.meaning, example_text = excluded.example_text,
      example_author = excluded.example_author, retired = excluded.retired
  `,
  rowMember: `
    INSERT INTO synonym_row_members (row_id, position, text, word_id, shade_note)
    VALUES (?, ?, ?, ?, ?)
  `,
  rowStress: 'INSERT INTO synonym_row_stress (row_id, member, position) VALUES (?, ?, ?)',
  tip: `
    INSERT INTO tips (
      id, title, non_standard_form, standard_form, explanation, example_text, example_author,
      question_prompt, right_answer, retired
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      title = excluded.title, non_standard_form = excluded.non_standard_form,
      standard_form = excluded.standard_form, explanation = excluded.explanation,
      example_text = excluded.example_text, example_author = excluded.example_author,
      question_prompt = excluded.question_prompt, right_answer = excluded.right_answer,
      retired = excluded.retired
  `,
  wrongAnswer: 'INSERT INTO tip_wrong_answers (tip_id, position, text) VALUES (?, ?, ?)',
  crosswordWord: `
    INSERT INTO crossword_words (date, position, entry_id, answer, clue, start_row, start_column, direction)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  collection: `
    INSERT INTO curated_collections (id, name, description, published_on) VALUES (?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      name = excluded.name, description = excluded.description, published_on = excluded.published_on
  `,
  collectionEntry:
    'INSERT INTO curated_collection_entries (collection_id, position, entry_id) VALUES (?, ?, ?)',
} as const;

const statement = (sql: string, ...params: BindValue[]): Statement => ({ sql, params });

/** The tables of a record's child rows, each with the column naming the record. */
const CHILD_TABLES = {
  word: [
    ['word_stress', 'word_id'],
    ['definitions', 'word_id'],
    ['examples', 'word_id'],
    ['related_words', 'word_id'],
    ['word_registers', 'word_id'],
    ['word_corrections', 'word_id'],
    ['sources', 'entry_id'],
  ],
  correction: [
    ['correction_equivalents', 'correction_id'],
    ['correction_literary_uses', 'correction_id'],
    ['sources', 'entry_id'],
  ],
  idiom: [
    ['idiom_definitions', 'idiom_id'],
    ['idiom_examples', 'idiom_id'],
    ['sources', 'entry_id'],
  ],
  synonymRow: [
    ['synonym_row_members', 'row_id'],
    ['synonym_row_stress', 'row_id'],
    ['sources', 'entry_id'],
  ],
  tip: [
    ['tip_wrong_answers', 'tip_id'],
    ['sources', 'entry_id'],
  ],
  crosswordDay: [['crossword_words', 'date']],
  curatedCollection: [['curated_collection_entries', 'collection_id']],
} as const;

/** Removes the child rows of a record, keyed by its id (a Crossword Day's by its date). */
export function childDeletes(kind: keyof typeof CHILD_TABLES, key: string): Statement[] {
  return CHILD_TABLES[kind].map(([table, column]) =>
    statement(`DELETE FROM ${table} WHERE ${column} = ?`, key),
  );
}

export function entryRow({ id, kind }: Entry): Statement {
  return statement(SQL.entry, id, kind);
}

function sourceRows({ id, sources }: Entry): Statement[] {
  return sources.map((source, position) =>
    statement(
      SQL.source,
      id,
      position,
      source.title,
      source.shortName ?? null,
      source.url ?? null,
      source.archivedUrl ?? null,
    ),
  );
}

export function correctionRows(correction: Correction): Statement[] {
  return [
    statement(
      SQL.correction,
      correction.id,
      correction.nonStandardForm,
      correction.correctionType,
      correction.explanation,
      correction.examplePair.nonStandard,
      correction.examplePair.standard,
      correction.categoryId,
      correction.retired ? 1 : 0,
    ),
    ...correction.standardEquivalents.map((text, position) =>
      statement(SQL.equivalent, correction.id, position, text),
    ),
    ...correction.literaryUses.map((use, position) =>
      statement(
        SQL.literaryUse,
        correction.id,
        position,
        use.text,
        use.author,
        use.work,
        use.authorDeathYear,
        use.workYear ?? null,
        use.url ?? null,
      ),
    ),
    ...sourceRows(correction),
  ];
}

export function idiomRows(idiom: Idiom): Statement[] {
  return [
    statement(
      SQL.idiom,
      idiom.id,
      idiom.expression,
      idiom.idiomType,
      idiom.etymology ?? null,
      idiom.retired ? 1 : 0,
    ),
    ...[idiom.primaryDefinition, ...idiom.extraDefinitions].map((text, position) =>
      statement(SQL.idiomDefinition, idiom.id, position, text),
    ),
    ...idiom.examples.map((example, position) =>
      statement(SQL.idiomExample, idiom.id, position, example.text, example.author ?? null),
    ),
    ...sourceRows(idiom),
  ];
}

/** A Word's rows; `needsNewRecording` is written for a new Word only. */
export function wordRows(word: Word, needsNewRecording: boolean): Statement[] {
  return [
    statement(
      SQL.word,
      word.id,
      word.lemma,
      word.partOfSpeech,
      word.gender ?? null,
      word.categoryId,
      word.rarity,
      word.etymology ?? null,
      word.region ?? null,
      word.history ?? null,
      word.origin ?? null,
      word.illustration ?? null,
      word.retired ? 1 : 0,
      needsNewRecording ? 1 : 0,
    ),
    ...word.stress.map((position) => statement(SQL.stress, word.id, position)),
    ...[word.primaryDefinition, ...word.extraDefinitions].map((text, position) =>
      statement(SQL.definition, word.id, position, text),
    ),
    ...word.examples.map((example, position) =>
      statement(SQL.example, word.id, position, example.text, example.author ?? null),
    ),
    ...word.synonyms.map((text, position) =>
      statement(SQL.relatedWord, word.id, 'synonym', position, text),
    ),
    ...word.antonyms.map((text, position) =>
      statement(SQL.relatedWord, word.id, 'antonym', position, text),
    ),
    ...word.registers.map((register, position) =>
      statement(SQL.register, word.id, position, register),
    ),
    ...word.correctionIds.map((correctionId, position) =>
      statement(SQL.correctionLink, word.id, position, correctionId),
    ),
    ...sourceRows(word),
  ];
}

export function synonymRowRows(row: SynonymRow): Statement[] {
  return [
    statement(
      SQL.row,
      row.id,
      row.dominant.text,
      row.dominant.wordId ?? null,
      row.meaning,
      row.example?.text ?? null,
      row.example?.author ?? null,
      row.retired ? 1 : 0,
    ),
    ...row.members.map((member, position) =>
      statement(
        SQL.rowMember,
        row.id,
        position,
        member.text,
        member.wordId ?? null,
        member.shadeNote ?? null,
      ),
    ),
    ...[row.dominant, ...row.members].flatMap(({ stress }, member) =>
      stress.map((position) => statement(SQL.rowStress, row.id, member, position)),
    ),
    ...sourceRows(row),
  ];
}

export function tipRows(tip: Tip): Statement[] {
  return [
    statement(
      SQL.tip,
      tip.id,
      tip.title,
      tip.nonStandardForm ?? null,
      tip.standardForm,
      tip.explanation,
      tip.example?.text ?? null,
      tip.example?.author ?? null,
      tip.gameQuestion.prompt,
      tip.gameQuestion.rightAnswer,
      tip.retired ? 1 : 0,
    ),
    ...tip.gameQuestion.wrongAnswers.map((text, position) =>
      statement(SQL.wrongAnswer, tip.id, position, text),
    ),
    ...sourceRows(tip),
  ];
}

export function crosswordDayRows({ date, words }: CrosswordDay): Statement[] {
  return words.map(({ entryId, answer, clue, row, column, direction }, position) =>
    statement(SQL.crosswordWord, date, position, entryId, answer, clue, row, column, direction),
  );
}

export function curatedCollectionRows({
  id,
  name,
  description,
  publishedOn,
  entryIds,
}: CuratedCollection): Statement[] {
  return [
    statement(SQL.collection, id, name, description, publishedOn),
    ...entryIds.map((entryId, position) => statement(SQL.collectionEntry, id, position, entryId)),
  ];
}
