import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { PACK_SCHEMA, type PackContent, type PackMetadata } from './pack-layout';

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
    insertMetadata.run('edition_id', metadata.editionId);
    insertMetadata.run('content_version', String(metadata.contentVersion));
    insertMetadata.run('checksum', metadata.checksum);

    const insertCategory = db.prepare(
      'INSERT INTO categories (id, display_name, position) VALUES (?, ?, ?)',
    );
    content.categories.forEach((category, position) => {
      insertCategory.run(category.id, category.displayName, position);
    });

    const insertWord = db.prepare(
      'INSERT INTO words (id, lemma, part_of_speech, category_id) VALUES (?, ?, ?, ?)',
    );
    const insertStress = db.prepare('INSERT INTO word_stress (word_id, position) VALUES (?, ?)');
    const insertDefinition = db.prepare(
      'INSERT INTO definitions (word_id, position, text) VALUES (?, ?, ?)',
    );
    for (const word of content.words) {
      insertWord.run(word.id, word.lemma, word.partOfSpeech, word.categoryId);
      for (const position of word.stress) insertStress.run(word.id, position);
      insertDefinition.run(word.id, 0, word.primaryDefinition);
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
