import { readFileSync } from 'node:fs';

import type { ContentSnapshot } from '@slovo/contracts/api';
import { loadEdition } from '@slovo/core';

import { buildFromSnapshot, type BuildResult } from './build';
import { EDITIONS_DIR, openEdition } from './edition-folder';
import { readEdition } from './read-edition';

// Helpers the Language Pack tests share. No module of the package imports them.

/** The UA Edition's folder. */
export const ukrainianFolder = openEdition(EDITIONS_DIR, 'uk');

/** The UA Edition, loaded by the Core from its config file as the app loads it. */
export const ukrainian = loadEdition(
  JSON.parse(readFileSync(ukrainianFolder.path('config'), 'utf8')) as unknown,
);

/**
 * The UA Edition's content as the backend's snapshot answers it after the
 * one-time import of its folder: every record, at the manifest's content
 * version, none needing a new Recording. The backend's own tests hold its
 * snapshot to this one.
 */
export function ukrainianSnapshot(): ContentSnapshot {
  const { valid } = readEdition(ukrainianFolder.dir, { registryRequired: true, today: new Date() });
  if (valid === undefined) throw new Error('The Ukrainian Edition does not read');
  const { content } = valid;
  return {
    editionId: content.editionId,
    contentVersion: content.contentVersion,
    words: [...content.words],
    idioms: [...content.idioms],
    corrections: [...content.corrections],
    tips: [...content.tips],
    synonymRows: [...content.synonymRows],
    curatedCollections: [...(content.curatedCollections ?? [])],
    crosswordDays: [...(content.crosswordDays ?? [])],
    needsNewRecording: [],
  };
}

/** Builds the UA Language Pack as the app build does: the folder's config and assets, the snapshot's records. */
export function buildUkrainianPack(outFile: string): BuildResult {
  return buildFromSnapshot({
    editionDir: ukrainianFolder.dir,
    snapshot: ukrainianSnapshot(),
    outFile,
  });
}

/**
 * A font file with a glyph for each of the given characters and no other:
 * the smallest TrueType file a character map can be read from, a `cmap`
 * table alone with one format 4 subtable. Characters outside the Basic
 * Multilingual Plane are not supported.
 */
export function fontWith(characters: string): Buffer {
  const codes = [...new Set(Array.from(characters, (character) => character.charCodeAt(0)))].sort(
    (a, b) => a - b,
  );
  // One segment per character, mapping it to glyph 1, 2, … in turn, and the closing segment.
  const segments = [
    ...codes.map((code, index) => ({ code, delta: (index + 1 - code) & 0xffff })),
    { code: 0xffff, delta: 1 },
  ];
  const count = segments.length;
  const subtable = Buffer.alloc(16 + 8 * count);
  subtable.writeUInt16BE(4, 0);
  subtable.writeUInt16BE(subtable.length, 2);
  subtable.writeUInt16BE(2 * count, 6);
  segments.forEach(({ code, delta }, index) => {
    subtable.writeUInt16BE(code, 14 + 2 * index);
    subtable.writeUInt16BE(code, 16 + 2 * count + 2 * index);
    subtable.writeUInt16BE(delta, 16 + 4 * count + 2 * index);
  });
  const cmap = Buffer.alloc(12);
  cmap.writeUInt16BE(1, 2);
  cmap.writeUInt16BE(3, 4);
  cmap.writeUInt16BE(1, 6);
  cmap.writeUInt32BE(12, 8);
  const header = Buffer.alloc(28);
  header.writeUInt32BE(0x00010000, 0);
  header.writeUInt16BE(1, 4);
  header.write('cmap', 12, 'latin1');
  header.writeUInt32BE(28, 20);
  header.writeUInt32BE(cmap.length + subtable.length, 24);
  return Buffer.concat([header, cmap, subtable]);
}
