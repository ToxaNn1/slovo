import { join } from 'node:path';

import { readSnapshotFile } from '@slovo/language-pack';
import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { describe, expect, it } from 'vitest';

import { TEST_MEDIA_BASE, testApp } from '../test-support';

const editionDir = join(EDITIONS_DIR, 'uk');
// The committed seed of an empty database: a slice of the UA Edition's content.
const seed = readSnapshotFile(join(editionDir, 'seed-snapshot.json'));

// The file's tests share its database, so the ones that find nothing imported come first.
describe('importing a content snapshot into the database', () => {
  it('refuses a snapshot that breaks a content rule by the rule name and writes nothing', async () => {
    const [word, ...words] = seed.words;
    if (word === undefined) throw new Error('the seed holds no Word');
    const broken = { ...seed, words: [{ ...word, categoryId: 'no-such-category' }, ...words] };
    const { client, importSnapshot } = testApp();

    const imported = await importSnapshot('uk', editionDir, broken);

    expect(imported).toMatchObject({
      ok: false,
      reason: 'refused',
      refusals: [expect.objectContaining({ rule: 'word-category', entryId: word.id })],
    });
    await expect(client.content.snapshot({ editionId: 'uk' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('refuses the snapshot of another Edition than the one named', async () => {
    const { importSnapshot } = testApp();

    expect(await importSnapshot('xx', editionDir, seed)).toEqual({
      ok: false,
      reason: 'unknown-edition',
    });
  });

  it('answers the snapshot it imported, every record and id kept, at its content version', async () => {
    const { client, importSnapshot } = testApp();

    const imported = await importSnapshot('uk', editionDir, seed);
    const snapshot = await client.content.snapshot({ editionId: 'uk' });

    expect(imported).toEqual({
      ok: true,
      contentVersion: seed.contentVersion,
      counts: {
        words: seed.words.length,
        idioms: seed.idioms.length,
        corrections: seed.corrections.length,
        tips: seed.tips.length,
        synonymRows: seed.synonymRows.length,
        curatedCollections: seed.curatedCollections.length,
        crosswordDays: seed.crosswordDays.length,
      },
    });
    expect(snapshot).toEqual({ ...seed, mediaBase: TEST_MEDIA_BASE });
  });

  it('leaves an imported Edition as it is without the override and imports over it with it', async () => {
    const { importSnapshot } = testApp();

    const refused = await importSnapshot('uk', editionDir, seed);
    const overridden = await importSnapshot('uk', editionDir, seed, { override: true });

    expect(refused).toEqual({ ok: false, reason: 'already-imported' });
    expect(overridden).toMatchObject({ ok: true, contentVersion: seed.contentVersion + 1 });
  });
});
