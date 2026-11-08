import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';

import type { PackMetadata } from '@slovo/contracts';

import { metadataRows, PACK_SCHEMA, type PackContent } from './pack-layout';
import {
  correctionRows,
  crosswordDayRows,
  curatedCollectionRows,
  entryRow,
  idiomRows,
  synonymRowRows,
  tipRows,
  wordRows,
  type Statement,
} from './record-rows';

/**
 * Writes the pack to a temporary file and moves it into place, so a failed
 * build never leaves a half-written pack behind. Rows go in sorted order, so
 * the same content yields the same file.
 */
export function writePack(outFile: string, content: PackContent, metadata: PackMetadata): void {
  mkdirSync(dirname(outFile), { recursive: true });
  const tempFile = `${outFile}.tmp`;
  rmSync(tempFile, { force: true });

  const db = new DatabaseSync(tempFile);
  try {
    db.exec(PACK_SCHEMA);
    db.exec('BEGIN');

    const insertMetadata = db.prepare('INSERT INTO metadata (key, value) VALUES (?, ?)');
    for (const { key, value } of metadataRows(metadata)) insertMetadata.run(key, value);

    for (const [table, categories] of [
      ['categories', content.categories],
      ['correction_categories', content.correctionCategories],
    ] as const) {
      const insertCategory = db.prepare(
        `INSERT INTO ${table} (id, display_name, description, tone, position) VALUES (?, ?, ?, ?, ?)`,
      );
      categories.forEach((category, position) => {
        insertCategory.run(
          category.id,
          category.displayName,
          category.description,
          category.tone,
          position,
        );
      });
    }

    const run = statementRunner(db);
    for (const entry of [
      ...content.words,
      ...content.corrections,
      ...content.idioms,
      ...content.synonymRows,
      ...content.tips,
    ]) {
      run(entryRow(entry));
    }
    for (const correction of content.corrections) correctionRows(correction).forEach(run);
    for (const idiom of content.idioms) idiomRows(idiom).forEach(run);
    const needsNewRecording = new Set(content.needsNewRecording);
    for (const word of content.words) wordRows(word, needsNewRecording.has(word.id)).forEach(run);
    // After the Words, whose ids a row may link.
    for (const row of content.synonymRows) synonymRowRows(row).forEach(run);
    for (const tip of content.tips) tipRows(tip).forEach(run);
    for (const day of content.crosswordDays ?? []) crosswordDayRows(day).forEach(run);
    for (const collection of content.curatedCollections ?? []) {
      curatedCollectionRows(collection).forEach(run);
    }

    db.exec('COMMIT');
  } catch (error) {
    db.close();
    rmSync(tempFile, { force: true });
    throw error;
  }
  db.close();
  renameSync(tempFile, outFile);
}

/** Runs statements over the database, preparing each SQL text once. */
function statementRunner(db: DatabaseSync): (statement: Statement) => void {
  const prepared = new Map<string, StatementSync>();
  return ({ sql, params }) => {
    let prepare = prepared.get(sql);
    if (prepare === undefined) {
      prepare = db.prepare(sql);
      prepared.set(sql, prepare);
    }
    prepare.run(...params);
  };
}
