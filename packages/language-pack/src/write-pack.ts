import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { Entry, PackMetadata } from '@slovo/contracts';

import { metadataRows, PACK_SCHEMA, type PackContent } from './pack-layout';

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

    const insertCategory = db.prepare(
      'INSERT INTO categories (id, display_name, position) VALUES (?, ?, ?)',
    );
    content.categories.forEach((category, position) => {
      insertCategory.run(category.id, category.displayName, position);
    });

    const insertEntry = db.prepare('INSERT INTO entries (id, kind) VALUES (?, ?)');
    for (const entry of [...content.words, ...content.corrections]) {
      insertEntry.run(entry.id, entry.kind);
    }

    const insertWord = db.prepare(`
      INSERT INTO words (id, lemma, part_of_speech, gender, category_id, rarity, etymology, region, retired)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    const insertSources = ({ id, sources }: Entry) => {
      sources.forEach((source, position) => {
        insertSource.run(
          id,
          position,
          source.title,
          source.url ?? null,
          source.archivedUrl ?? null,
        );
      });
    };

    const insertCorrection = db.prepare(`
      INSERT INTO corrections (
        id, non_standard_form, correction_type, explanation, example_non_standard, example_standard,
        retired
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertEquivalent = db.prepare(
      'INSERT INTO correction_equivalents (correction_id, position, text) VALUES (?, ?, ?)',
    );
    for (const correction of content.corrections) {
      insertCorrection.run(
        correction.id,
        correction.nonStandardForm,
        correction.correctionType,
        correction.explanation,
        correction.examplePair.nonStandard,
        correction.examplePair.standard,
        correction.retired ? 1 : 0,
      );
      correction.standardEquivalents.forEach((text, position) => {
        insertEquivalent.run(correction.id, position, text);
      });
      insertSources(correction);
    }

    const insertCorrectionLink = db.prepare(
      'INSERT INTO word_corrections (word_id, position, correction_id) VALUES (?, ?, ?)',
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
        word.region ?? null,
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
      word.correctionIds.forEach((correctionId, position) => {
        insertCorrectionLink.run(word.id, position, correctionId);
      });
      insertSources(word);
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
