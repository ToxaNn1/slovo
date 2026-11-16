import { join } from 'node:path';

import { readSnapshotFile } from '@slovo/language-pack';
import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { systemClock } from '@slovo/server-core';
import { describe, expect, it } from 'vitest';

import { TEST_MEDIA_BASE, testApp } from '../test-support';
import { createMediaRows } from './media-rows';

const editionDir = join(EDITIONS_DIR, 'uk');
// The committed seed of an empty database: a slice of the UA Edition's content.
const seed = readSnapshotFile(join(editionDir, 'seed-snapshot.json'));

/** The seed with the Word `w_009orq` changed as `change` says. */
function seedWithWord(change: (word: (typeof seed.words)[number]) => (typeof seed.words)[number]) {
  return {
    ...seed,
    words: seed.words.map((word) => (word.id === 'w_009orq' ? change(word) : word)),
  };
}

// The file's tests share its database, so the ones that find nothing imported come first.
describe('importing a content snapshot into the database', () => {
  it('refuses a snapshot that breaks a content rule by the rule name and writes nothing', async () => {
    const broken = seedWithWord((word) => ({ ...word, categoryId: 'no-such-category' }));
    const { client, importSnapshot } = testApp();

    const imported = await importSnapshot('uk', editionDir, broken);

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

  it('refuses the snapshot of another Edition than the one named', async () => {
    const { importSnapshot } = testApp();

    expect(await importSnapshot('xx', editionDir, seed)).toEqual({
      ok: false,
      reason: 'unknown-edition',
    });
  });

  it('answers the snapshot it imported, every record, id and retired flag kept, at its content version', async () => {
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
    expect(snapshot.corrections.some((correction) => correction.retired)).toBe(true);
  });

  it('leaves an imported Edition as it is without the override and imports over it with it, one version on', async () => {
    const { client, importSnapshot } = testApp();
    const before = await client.content.snapshot({ editionId: 'uk' });

    const refused = await importSnapshot('uk', editionDir, seed);
    const kept = await client.content.snapshot({ editionId: 'uk' });
    const overridden = await importSnapshot('uk', editionDir, seed, { override: true });

    expect(refused).toEqual({ ok: false, reason: 'already-imported' });
    expect(kept).toEqual(before);
    expect(overridden).toMatchObject({ ok: true, contentVersion: before.contentVersion + 1 });
    expect(await client.content.snapshot({ editionId: 'uk' })).toMatchObject({
      contentVersion: before.contentVersion + 1,
      words: seed.words,
    });
  });

  it('retires a record the snapshot of an override no longer holds, keeping it', async () => {
    // The database holds a Word the snapshot of the override never had.
    const [word] = seed.words;
    if (word === undefined) throw new Error('the seed holds no Word');
    // «обру́чик».
    const extra = { ...word, id: 'w_zzzzzz', lemma: 'обручик' };
    const { client, importSnapshot } = testApp();
    await importSnapshot(
      'uk',
      editionDir,
      { ...seed, words: [...seed.words, extra] },
      {
        override: true,
      },
    );

    const again = await importSnapshot('uk', editionDir, seed, { override: true });

    expect(again).toMatchObject({ ok: true });
    const snapshot = await client.content.snapshot({ editionId: 'uk' });
    expect(snapshot.words.find(({ id }) => id === 'w_zzzzzz')).toMatchObject({ retired: true });
    expect(snapshot.words).toHaveLength(seed.words.length + 1);
  });

  it('retires the Recordings of a Word an override changes the Lemma of, and asks for new ones', async () => {
    const changed = seedWithWord((word) => ({ ...word, lemma: 'обручик' }));
    const { client, importSnapshot, database } = testApp();
    await importSnapshot('uk', editionDir, seed, { override: true });
    await createMediaRows({ database, clock: systemClock }).saveRecording('uk', {
      wordId: 'w_009orq',
      narratorVoice: 'oksana',
      recordingKind: 'plain',
      hash: 'c'.repeat(64),
      size: 7000,
      durationMs: 900,
    });

    await importSnapshot('uk', editionDir, changed, { override: true });

    const snapshot = await client.content.snapshot({ editionId: 'uk' });
    expect(snapshot.recordings.filter(({ wordId }) => wordId === 'w_009orq')).toMatchObject([
      { retired: true },
    ]);
    expect(snapshot.needsNewRecording).toEqual(['w_009orq']);
  });
});
