import { DatabaseSync } from 'node:sqlite';

import { PartOfSpeechSchema, type Word } from '@slovo/contracts';
import type { ContentReadPort } from '@slovo/core';

import type { PackMetadata } from './pack-layout';

/** A Language Pack opened read-only in Node, for tests and tooling. */
export interface NodeLanguagePack extends ContentReadPort {
  metadata(): PackMetadata;
  close(): void;
}

interface WordRow {
  id: string;
  lemma: string;
  part_of_speech: string;
  category_id: string;
  primary_definition: string;
}

export function openLanguagePack(file: string): NodeLanguagePack {
  const db = new DatabaseSync(file, { readOnly: true });

  const selectIds = db.prepare('SELECT id FROM words ORDER BY id');
  const selectWord = db.prepare(`
    SELECT w.id, w.lemma, w.part_of_speech, w.category_id, d.text AS primary_definition
    FROM words w
    JOIN definitions d ON d.word_id = w.id AND d.position = 0
    WHERE w.id = ?
  `);
  const selectStress = db.prepare(
    'SELECT position FROM word_stress WHERE word_id = ? ORDER BY position',
  );
  const selectMetadata = db.prepare('SELECT key, value FROM metadata');

  function getWord(id: string): Word | undefined {
    const row = selectWord.get(id) as WordRow | undefined;
    if (row === undefined) return undefined;
    const stress = (selectStress.all(id) as { position: number }[]).map((r) => r.position);
    return {
      id: row.id,
      lemma: row.lemma,
      stress,
      partOfSpeech: PartOfSpeechSchema.parse(row.part_of_speech),
      primaryDefinition: row.primary_definition,
      categoryId: row.category_id,
    };
  }

  return {
    listWordIds: () => Promise.resolve((selectIds.all() as { id: string }[]).map((row) => row.id)),
    getWord: (id) => Promise.resolve(getWord(id)),
    metadata() {
      const values = new Map(
        (selectMetadata.all() as { key: string; value: string }[]).map((r) => [r.key, r.value]),
      );
      return {
        editionId: values.get('edition_id') ?? '',
        contentVersion: Number(values.get('content_version')),
        checksum: values.get('checksum') ?? '',
      };
    },
    close: () => {
      db.close();
    },
  };
}
