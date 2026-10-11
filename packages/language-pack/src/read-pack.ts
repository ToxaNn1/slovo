import { DatabaseSync } from 'node:sqlite';

import { WordSchema, type Word } from '@slovo/contracts';
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
  gender: string | null;
  category_id: string;
  rarity: number;
  etymology: string | null;
  retired: number;
}

interface SourceRow {
  title: string;
  url: string | null;
  archived_url: string | null;
}

export function openLanguagePack(file: string): NodeLanguagePack {
  const db = new DatabaseSync(file, { readOnly: true });

  const selectIds = db.prepare('SELECT id FROM words WHERE retired = 0 ORDER BY id');
  const selectWord = db.prepare('SELECT * FROM words WHERE id = ?');
  const selectStress = db.prepare(
    'SELECT position FROM word_stress WHERE word_id = ? ORDER BY position',
  );
  const selectDefinitions = db.prepare(
    'SELECT text FROM definitions WHERE word_id = ? ORDER BY position',
  );
  const selectExamples = db.prepare(
    'SELECT text, author FROM examples WHERE word_id = ? ORDER BY position',
  );
  const selectRelatedWords = db.prepare(
    'SELECT text FROM related_words WHERE word_id = ? AND relation = ? ORDER BY position',
  );
  const selectRegisters = db.prepare(
    'SELECT register FROM word_registers WHERE word_id = ? ORDER BY position',
  );
  const selectSources = db.prepare(
    'SELECT title, url, archived_url FROM sources WHERE entry_id = ? ORDER BY position',
  );
  const selectMetadata = db.prepare('SELECT key, value FROM metadata');

  function getWord(id: string): Word | undefined {
    const row = selectWord.get(id) as WordRow | undefined;
    if (row === undefined) return undefined;
    const [primaryDefinition, ...extraDefinitions] = (
      selectDefinitions.all(id) as { text: string }[]
    ).map((r) => r.text);
    const relatedWords = (relation: 'synonym' | 'antonym') =>
      (selectRelatedWords.all(id, relation) as { text: string }[]).map((r) => r.text);
    // Parsing checks the pack against the contracts and types the Word.
    return WordSchema.parse({
      id: row.id,
      lemma: row.lemma,
      stress: (selectStress.all(id) as { position: number }[]).map((r) => r.position),
      partOfSpeech: row.part_of_speech,
      ...(row.gender === null ? {} : { gender: row.gender }),
      primaryDefinition,
      extraDefinitions,
      examples: (selectExamples.all(id) as { text: string; author: string | null }[]).map(
        ({ text, author }) => (author === null ? { text } : { text, author }),
      ),
      synonyms: relatedWords('synonym'),
      antonyms: relatedWords('antonym'),
      ...(row.etymology === null ? {} : { etymology: row.etymology }),
      registers: (selectRegisters.all(id) as { register: string }[]).map((r) => r.register),
      categoryId: row.category_id,
      rarity: row.rarity,
      sources: (selectSources.all(id) as unknown as SourceRow[]).map(
        ({ title, url, archived_url }) => ({
          title,
          ...(url === null ? {} : { url }),
          ...(archived_url === null ? {} : { archivedUrl: archived_url }),
        }),
      ),
      retired: row.retired === 1,
    });
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
