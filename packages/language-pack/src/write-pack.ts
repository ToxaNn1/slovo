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

    const insertWord = db.prepare(`
      INSERT INTO words (id, lemma, part_of_speech, gender, category_id, rarity, etymology, retired)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertStress = db.prepare('INSERT INTO word_stress (word_id, position) VALUES (?, ?)');
    const insertDefinition = db.prepare(
      'INSERT INTO definitions (word_id, position, text) VALUES (?, ?, ?)',
    );
    const insertExample = db.prepare(
      'INSERT INTO examples (word_id, position, text, author) VALUES (?, ?, ?, ?)',
    );
    const insertRelatedWord = db.prepare(
      'INSERT INTO related_words (word_id, relation, position, text) VALUES (?, ?, ?, ?)',
    );
    const insertRegister = db.prepare(
      'INSERT INTO word_registers (word_id, position, register) VALUES (?, ?, ?)',
    );
    const insertSource = db.prepare(
      'INSERT INTO sources (entry_id, position, title, url, archived_url) VALUES (?, ?, ?, ?, ?)',
    );
    for (const word of content.words) {
      insertWord.run(
        word.id,
        word.lemma,
        word.partOfSpeech,
        word.gender ?? null,
        word.categoryId,
        word.rarity,
        word.etymology ?? null,
        word.retired ? 1 : 0,
      );
      for (const position of word.stress) insertStress.run(word.id, position);
      [word.primaryDefinition, ...word.extraDefinitions].forEach((text, position) => {
        insertDefinition.run(word.id, position, text);
      });
      word.examples.forEach((example, position) => {
        insertExample.run(word.id, position, example.text, example.author ?? null);
      });
      word.synonyms.forEach((text, position) => {
        insertRelatedWord.run(word.id, 'synonym', position, text);
      });
      word.antonyms.forEach((text, position) => {
        insertRelatedWord.run(word.id, 'antonym', position, text);
      });
      word.registers.forEach((register, position) => {
        insertRegister.run(word.id, position, register);
      });
      word.sources.forEach((source, position) => {
        insertSource.run(
          word.id,
          position,
          source.title,
          source.url ?? null,
          source.archivedUrl ?? null,
        );
      });
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
