import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readEdition } from '@slovo/language-pack';
import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { systemClock } from '@slovo/server-core';
import { afterAll, describe, expect, it } from 'vitest';

import { testApp } from '../test-support';

/** A copy of the UA Edition folder the test may change, removed after the file. */
function copyOfUkrainian(): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'slovo-import-')), 'uk');
  cpSync(join(EDITIONS_DIR, 'uk'), dir, { recursive: true });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const folder = copyOfUkrainian();
// What the folder holds, read as the Language Pack build reads it.
const authored = readEdition(folder, { registryRequired: true, today: systemClock.now() }).valid;
if (authored === undefined) throw new Error('the UA Edition folder does not read');
const { content } = authored;

// The file's tests share its database, so the ones that find nothing imported come first.
describe('importing an Edition into the database', () => {
  it('refuses an import that breaks a content rule by the rule name and writes nothing', async () => {
    const broken = copyOfUkrainian();
    const file = join(broken, 'content', 'words', 'w_009orq.json');
    const word = readFileSync(file, 'utf8').replace('"old-crafts"', '"no-such-category"');
    writeFileSync(file, word);
    const { client, importContent } = testApp();

    const imported = await importContent('uk', broken);

    expect(imported).toMatchObject({
      ok: false,
      reason: 'refused',
      refusals: [expect.objectContaining({ rule: 'word-category', entryId: 'w_009orq' })],
    });
    await expect(client.content.snapshot({ editionId: 'uk' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('answers no snapshot of an Edition not imported, so it takes no content writes yet', async () => {
    const { client } = testApp();

    await expect(client.content.snapshot({ editionId: 'uk' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('refuses the import of an Edition the backend does not serve', async () => {
    const { importContent } = testApp();

    expect(await importContent('xx', folder)).toEqual({ ok: false, reason: 'unknown-edition' });
  });

  it('answers a snapshot with every record, ids and retired flags kept, at the manifest version', async () => {
    const { client, importContent } = testApp();

    const imported = await importContent('uk', folder);
    const snapshot = await client.content.snapshot({ editionId: 'uk' });

    expect(imported).toEqual({
      ok: true,
      contentVersion: content.contentVersion,
      counts: {
        words: content.words.length,
        idioms: content.idioms.length,
        corrections: content.corrections.length,
        tips: content.tips.length,
        synonymRows: content.synonymRows.length,
        curatedCollections: content.curatedCollections?.length ?? 0,
        crosswordDays: content.crosswordDays?.length ?? 0,
      },
    });
    expect(snapshot).toEqual({
      editionId: 'uk',
      contentVersion: content.contentVersion,
      words: content.words,
      idioms: content.idioms,
      corrections: content.corrections,
      tips: content.tips,
      synonymRows: content.synonymRows,
      curatedCollections: content.curatedCollections ?? [],
      crosswordDays: content.crosswordDays ?? [],
    });
    expect(snapshot.corrections.some((correction) => correction.retired)).toBe(true);
  });

  it('refuses a second import without the override and keeps the snapshot', async () => {
    const { client, importContent } = testApp();
    await importContent('uk', folder);
    const before = await client.content.snapshot({ editionId: 'uk' });

    const again = await importContent('uk', folder);

    expect(again).toEqual({ ok: false, reason: 'already-imported' });
    expect(await client.content.snapshot({ editionId: 'uk' })).toEqual(before);
  });

  it('takes a second import with the override, at the version the database holds', async () => {
    const { client, importContent } = testApp();
    await importContent('uk', folder);

    const again = await importContent('uk', folder, { override: true });

    expect(again).toMatchObject({ ok: true, contentVersion: content.contentVersion + 1 });
    expect(await client.content.snapshot({ editionId: 'uk' })).toMatchObject({
      contentVersion: content.contentVersion + 1,
      words: content.words,
    });
  });
});
