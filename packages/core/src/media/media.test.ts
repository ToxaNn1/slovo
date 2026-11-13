import type { IllustrationRow, RecordingRow } from '@slovo/contracts';
import { PATCH_FORMAT, type Patch } from '@slovo/contracts/api';
import { describe, expect, it } from 'vitest';

import { createMedia, MEDIA_CACHE_LIMIT, type MediaSwitch } from './media';
import {
  createFakeMediaFetcher,
  createMemoryContentStore,
  createMemoryMediaCache,
} from '../testing';
import { fakeClock } from '../test-support';

const BASE = 'https://media.slovo.test';
const MB = 1024 * 1024;

function hashOf(letter: string): string {
  return letter.repeat(64);
}

function recording(
  wordId: string,
  hash: string,
  { narratorVoice = 'oksana', size = 1_000, retired = false } = {},
): RecordingRow {
  return { wordId, narratorVoice, recordingKind: 'plain', hash, size, durationMs: 900, retired };
}

function illustration(
  wordId: string,
  hash: string,
  { size = 500, retired = false } = {},
): IllustrationRow {
  return { wordId, hash, size, retired };
}

/** A Patch of the Edition `uk` from content version `since`, carrying the media rows given. */
function patchOf(
  since: number,
  records: Pick<Partial<Patch>, 'recordings' | 'illustrations'>,
): Patch {
  return {
    editionId: 'uk',
    since,
    contentVersion: since + 1,
    patchFormat: PATCH_FORMAT,
    words: [],
    idioms: [],
    corrections: [],
    tips: [],
    synonymRows: [],
    curatedCollections: [],
    crosswordDays: [],
    mediaBase: BASE,
    recordings: [],
    illustrations: [],
    ...records,
  };
}

/** The rows of the Word `starter`, whose Recording in the default voice and Illustration the app bundles. */
const starterRows = {
  recordings: [recording('starter', hashOf('s'))],
  illustrations: [illustration('starter', hashOf('t'))],
};

/** The bundled files of the Starter Media, by Media Store path: the Word `starter` in the default voice. */
const starter = {
  file: (path: string) =>
    ({
      [`recordings/oksana/plain/starter.${hashOf('s')}.mp3`]: 'bundled:starter.mp3',
      [`illustrations/starter.${hashOf('t')}.png`]: 'bundled:starter.png',
    })[path],
};

/** The Core media over a memory pack, a memory file cache and a fake fetcher serving every row. */
async function device({
  rows = {},
  off = [],
  needsNewRecording = [],
}: {
  rows?: Pick<Partial<Patch>, 'recordings' | 'illustrations'>;
  off?: MediaSwitch[];
  needsNewRecording?: string[];
} = {}) {
  const store = createMemoryContentStore({ contentVersion: 1, needsNewRecording });
  const patch = patchOf(1, {
    recordings: [...starterRows.recordings, ...(rows.recordings ?? [])],
    illustrations: [...starterRows.illustrations, ...(rows.illustrations ?? [])],
  });
  await store.apply(patch, '"uk.2.p3"');
  const cache = createMemoryMediaCache();
  const fetcher = createFakeMediaFetcher();
  for (const row of patch.recordings)
    fetcher.serve(
      `${BASE}/recordings/${row.narratorVoice}/plain/${row.wordId}.${row.hash}.mp3`,
      row.size,
    );
  for (const row of patch.illustrations)
    fetcher.serve(`${BASE}/illustrations/${row.wordId}.${row.hash}.png`, row.size);
  const time = fakeClock();
  const media = createMedia({
    store,
    cache,
    fetcher,
    starter,
    clock: time.clock,
    defaultVoice: 'oksana',
    isOn: (name) => !off.includes(name),
  });
  return { store, cache, fetcher, media, advance: time.advance };
}

describe('the media of a Word card', () => {
  it('answers a Starter Media Word bundled, with no download', async () => {
    const { media, fetcher } = await device();

    expect(await media.ofWord('starter', 'oksana')).toEqual({
      recording: { kind: 'bundled', asset: 'bundled:starter.mp3' },
      illustration: { kind: 'bundled', asset: 'bundled:starter.png' },
    });
    expect(fetcher.asked).toEqual([]);
  });

  it('answers a Starter Media Word whose Patch brought a new file remote, at the new URL', async () => {
    const { media, store } = await device();
    const patch = patchOf(2, {
      recordings: [
        recording('starter', hashOf('s'), { retired: true }),
        recording('starter', hashOf('u')),
      ],
      illustrations: [illustration('starter', hashOf('t'), { retired: true })],
    });
    await store.apply(patch, '"uk.3.p3"');
    await media.patchApplied(patch);

    expect(await media.ofWord('starter', 'oksana')).toEqual({
      recording: {
        kind: 'remote',
        url: `${BASE}/recordings/oksana/plain/starter.${hashOf('u')}.mp3`,
      },
      illustration: { kind: 'absent' },
    });
  });

  it('answers a Word with rows and no cached file remote, at its Media Store URL', async () => {
    const { media } = await device({
      rows: {
        recordings: [recording('w1', hashOf('a'))],
        illustrations: [illustration('w1', hashOf('b'))],
      },
    });

    expect(await media.ofWord('w1', 'oksana')).toEqual({
      recording: { kind: 'remote', url: `${BASE}/recordings/oksana/plain/w1.${hashOf('a')}.mp3` },
      illustration: { kind: 'remote', url: `${BASE}/illustrations/w1.${hashOf('b')}.png` },
    });
  });

  it('answers a Word without rows absent', async () => {
    const { media } = await device();

    expect(await media.ofWord('w1', 'oksana')).toEqual({
      recording: { kind: 'absent' },
      illustration: { kind: 'absent' },
    });
  });

  it('answers the Recording of a Word marked «needs new recording» absent', async () => {
    const { media } = await device({
      rows: { recordings: [recording('w1', hashOf('a'))] },
      needsNewRecording: ['w1', 'starter'],
    });

    expect((await media.ofWord('w1', 'oksana')).recording).toEqual({ kind: 'absent' });
    expect((await media.ofWord('starter', 'oksana')).recording).toEqual({ kind: 'absent' });
  });
});

describe('the prefetch of the next Feed cards', () => {
  it('downloads the media of the next 20 cards in the chosen voice only, and answers them cached', async () => {
    const ids = Array.from({ length: 21 }, (_, i) => `w${String(i + 1)}`);
    const { media, fetcher } = await device({
      rows: {
        recordings: ids.flatMap((id) => [
          recording(id, hashOf('a')),
          recording(id, hashOf('b'), { narratorVoice: 'taras' }),
        ]),
        illustrations: [illustration('w1', hashOf('c'))],
      },
    });

    await media.prefetch(ids, 'taras');

    expect(fetcher.asked).toHaveLength(21);
    expect(fetcher.asked.every((url) => !url.includes('/oksana/'))).toBe(true);
    expect(await media.ofWord('w1', 'taras')).toEqual({
      recording: { kind: 'cached', uri: `memory://recordings/taras/plain/w1.${hashOf('b')}.mp3` },
      illustration: { kind: 'cached', uri: `memory://illustrations/w1.${hashOf('c')}.png` },
    });
    expect((await media.ofWord('w21', 'taras')).recording).toEqual({
      kind: 'remote',
      url: `${BASE}/recordings/taras/plain/w21.${hashOf('b')}.mp3`,
    });
  });

  it('downloads nothing twice', async () => {
    const { media, fetcher } = await device({
      rows: { recordings: [recording('w1', hashOf('a'))] },
    });

    await media.prefetch(['w1'], 'oksana');
    await media.prefetch(['w1'], 'oksana');

    expect(fetcher.asked).toHaveLength(1);
  });

  it('leaves the cache unchanged after a half download, and keeps on with the next cards', async () => {
    const { media, fetcher } = await device({
      rows: { recordings: [recording('w1', hashOf('a')), recording('w2', hashOf('b'))] },
    });
    fetcher.cutShort(`${BASE}/recordings/oksana/plain/w1.${hashOf('a')}.mp3`);

    await media.prefetch(['w1', 'w2'], 'oksana');

    expect((await media.ofWord('w1', 'oksana')).recording.kind).toBe('remote');
    expect((await media.ofWord('w2', 'oksana')).recording.kind).toBe('cached');
  });

  it('leaves the cache unchanged when a download fails', async () => {
    const { media, fetcher } = await device({
      rows: { recordings: [recording('w1', hashOf('a'))] },
    });
    fetcher.fail(`${BASE}/recordings/oksana/plain/w1.${hashOf('a')}.mp3`);

    await media.prefetch(['w1'], 'oksana');

    expect((await media.ofWord('w1', 'oksana')).recording.kind).toBe('remote');
  });

  it('fetches no Recording with `pronunciation` off and no Illustration with `illustrations` off', async () => {
    const rows = {
      recordings: [recording('w1', hashOf('a'))],
      illustrations: [illustration('w1', hashOf('b'))],
    };
    const silent = await device({ rows, off: ['pronunciation'] });
    const plain = await device({ rows, off: ['illustrations'] });

    await silent.media.prefetch(['w1'], 'oksana');
    await plain.media.prefetch(['w1'], 'oksana');

    expect(silent.fetcher.asked).toEqual([`${BASE}/illustrations/w1.${hashOf('b')}.png`]);
    expect((await silent.media.ofWord('starter', 'oksana')).recording).toEqual({ kind: 'absent' });
    expect(plain.fetcher.asked).toEqual([`${BASE}/recordings/oksana/plain/w1.${hashOf('a')}.mp3`]);
    expect((await plain.media.ofWord('starter', 'oksana')).illustration).toEqual({
      kind: 'absent',
    });
  });

  it('downloads in the voice each call names, so a voice the reader changes takes effect at once', async () => {
    const { media, fetcher } = await device({
      rows: {
        recordings: [
          recording('w1', hashOf('a')),
          recording('w1', hashOf('b'), { narratorVoice: 'taras' }),
        ],
      },
    });

    await media.prefetch(['w1'], 'oksana');
    await media.prefetch(['w1'], 'taras');

    expect(fetcher.asked).toEqual([
      `${BASE}/recordings/oksana/plain/w1.${hashOf('a')}.mp3`,
      `${BASE}/recordings/taras/plain/w1.${hashOf('b')}.mp3`,
    ]);
    expect((await media.ofWord('w1', 'taras')).recording).toEqual({
      kind: 'cached',
      uri: `memory://recordings/taras/plain/w1.${hashOf('b')}.mp3`,
    });
  });

  it('uses the default voice with `narratorVoice` off', async () => {
    const { media, fetcher } = await device({
      off: ['narratorVoice'],
      rows: {
        recordings: [
          recording('w1', hashOf('a')),
          recording('w1', hashOf('b'), { narratorVoice: 'taras' }),
        ],
      },
    });

    await media.prefetch(['w1'], 'taras');

    expect(fetcher.asked).toEqual([`${BASE}/recordings/oksana/plain/w1.${hashOf('a')}.mp3`]);
  });
});

describe('the media cache', () => {
  it(`keeps at most ${String(MEDIA_CACHE_LIMIT / MB)} MB, the least recently played file evicted first, never a Starter file`, async () => {
    const size = 35 * MB;
    const { media, advance } = await device({
      rows: {
        recordings: [
          recording('w1', hashOf('a'), { size }),
          recording('w2', hashOf('b'), { size }),
          recording('w3', hashOf('c'), { size }),
        ],
      },
    });
    await media.prefetch(['w1', 'w2'], 'oksana');
    advance(60_000);
    await media.used('w1', 'recording', 'oksana');
    advance(60_000);

    await media.prefetch(['w3'], 'oksana');

    expect((await media.ofWord('w1', 'oksana')).recording.kind).toBe('cached');
    expect((await media.ofWord('w2', 'oksana')).recording.kind).toBe('remote');
    expect((await media.ofWord('w3', 'oksana')).recording.kind).toBe('cached');
    expect((await media.ofWord('starter', 'oksana')).recording.kind).toBe('bundled');
  });

  it('downloads a remote Recording on a tap and answers it cached', async () => {
    const { media } = await device({ rows: { recordings: [recording('w1', hashOf('a'))] } });

    const cached = await media.downloadRecording('w1', 'oksana');

    expect(cached).toEqual({
      kind: 'cached',
      uri: `memory://recordings/oksana/plain/w1.${hashOf('a')}.mp3`,
    });
    expect((await media.ofWord('w1', 'oksana')).recording).toEqual(cached);
  });

  it('downloads a file once when a tap comes while the prefetch is downloading it', async () => {
    const { media, fetcher } = await device({
      rows: { recordings: [recording('w1', hashOf('a'))] },
    });

    const [, tapped] = await Promise.all([
      media.prefetch(['w1'], 'oksana'),
      media.downloadRecording('w1', 'oksana'),
    ]);

    expect(fetcher.asked).toEqual([`${BASE}/recordings/oksana/plain/w1.${hashOf('a')}.mp3`]);
    expect(tapped.kind).toBe('cached');
  });
});

describe('a Patch applied', () => {
  it('evicts the file of a retired row, and the card answers the new URL', async () => {
    const { media, store, cache } = await device({
      rows: {
        recordings: [recording('w1', hashOf('a'))],
        illustrations: [illustration('w1', hashOf('b'))],
      },
    });
    await media.prefetch(['w1'], 'oksana');
    const patch = patchOf(2, {
      recordings: [recording('w1', hashOf('a'), { retired: true }), recording('w1', hashOf('d'))],
      illustrations: [
        illustration('w1', hashOf('b'), { retired: true }),
        illustration('w1', hashOf('e')),
      ],
    });
    await store.apply(patch, '"uk.3.p3"');

    await media.patchApplied(patch);

    expect(await media.ofWord('w1', 'oksana')).toEqual({
      recording: { kind: 'remote', url: `${BASE}/recordings/oksana/plain/w1.${hashOf('d')}.mp3` },
      illustration: { kind: 'remote', url: `${BASE}/illustrations/w1.${hashOf('e')}.png` },
    });
    expect(await cache.files()).toEqual([]);
  });
});
