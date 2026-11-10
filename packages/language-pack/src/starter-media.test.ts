import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EditionConfigSchema, type EditionConfig } from '@slovo/contracts';
import { ContentSnapshotSchema, type ContentSnapshot } from '@slovo/contracts/api';
import { describe, expect, it } from 'vitest';

import {
  downloadStarterMedia,
  starterMediaFiles,
  starterWordIds,
  starterMediaOf,
  STARTER_WORDS,
  type StarterMediaList,
} from './starter-media';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

const config: EditionConfig = EditionConfigSchema.parse(
  JSON.parse(readFileSync(fixture('valid/edition.json'), 'utf8')),
);

const hash = (n: number) => n.toString(16).padStart(64, '0');

/** The snapshot fixture grown to 320 Words, every one recorded in both voices and illustrated. */
function snapshotOf320(): ContentSnapshot {
  const base = ContentSnapshotSchema.parse(
    JSON.parse(readFileSync(fixture('snapshot.json'), 'utf8')),
  );
  const [first] = base.words;
  if (first === undefined) throw new Error('The snapshot fixture has no Word');
  const grown = Array.from({ length: 317 }, (_, i) => ({
    ...first,
    id: `w_st${String(i + 1).padStart(4, '0')}`,
    retired: i === 0,
  }));
  // The fixture retires the sample Word; here it is live, as an Edition keeps it.
  const words = [...base.words.map((word) => ({ ...word, retired: false })), ...grown].sort(
    (a, b) => a.id.localeCompare(b.id),
  );
  return {
    ...base,
    words,
    recordings: words.flatMap((word, i) =>
      ['anna', 'boris'].map((voice) => ({
        wordId: word.id,
        narratorVoice: voice,
        recordingKind: 'plain' as const,
        hash: hash(i),
        size: 1000 + i,
        durationMs: 900,
        retired: false,
      })),
    ),
    illustrations: words.map((word, i) => ({
      wordId: word.id,
      hash: hash(i),
      size: 2000 + i,
      retired: false,
    })),
    needsNewRecording: ['w_st0002'],
  };
}

describe('The Starter Media list', () => {
  const snapshot = snapshotOf320();
  const list = starterMediaOf(config, snapshot);
  const live = snapshot.words.filter((word) => !word.retired).map((word) => word.id);

  it('holds the first 300 live Words of the default Mix, in id order, and the sample Word', () => {
    expect(STARTER_WORDS).toBe(300);
    expect(list.wordIds).toEqual(live.slice(0, 300));
    expect(list.wordIds).not.toContain('w_st0001');
    expect(list.sampleWordId).toBe('w_fx0001');
    expect(list.voice).toBe('anna');
  });

  it("bundles the default voice's Recordings of those Words and the sample Word in every voice", () => {
    const recorded = list.files.filter((file) => file.kind === 'recording');
    const byVoice = (voice: string) =>
      recorded.filter((file) => file.voice === voice).map((file) => file.wordId);
    // The Word whose text changed since its Recordings waits for a new one.
    expect(byVoice('anna')).toEqual(list.wordIds.filter((id) => id !== 'w_st0002'));
    expect(byVoice('boris')).toEqual(['w_fx0001']);
    const sample = recorded.find((file) => file.voice === 'boris');
    expect(sample?.path).toMatch(/^recordings\/boris\/plain\/w_fx0001\.[0-9a-f]{64}\.mp3$/);
    expect(sample?.url).toBe(`https://media.slovo.test/${sample?.path ?? ''}`);
  });

  it('bundles the Illustrations of those Words with their sizes', () => {
    const pictures = list.files.filter((file) => file.kind === 'illustration');
    expect(pictures.map((file) => file.wordId)).toEqual(list.wordIds);
    expect(pictures[0]?.path).toMatch(/^illustrations\/w_fx0001\.[0-9a-f]{64}\.png$/);
    expect(pictures[0]?.size).toBeGreaterThan(2000 - 1);
  });

  it('takes only the Words of the Categories the default Mix lists', () => {
    const [first] = snapshot.words;
    const listed: EditionConfig = {
      ...config,
      userSettingDefaults: {
        ...config.userSettingDefaults,
        mix: { ...config.userSettingDefaults.mix, categories: ['elsewhere'] },
      },
    };
    const words = snapshot.words.map((word) =>
      word.id === first?.id ? word : { ...word, categoryId: 'elsewhere' },
    );
    const chosen = starterMediaOf(listed, { ...snapshot, words });
    expect(chosen.wordIds).not.toContain(first?.id);
    expect(chosen.wordIds).toHaveLength(300);
  });
});

describe('The Starter Media folder', () => {
  const list: StarterMediaList = {
    voice: 'anna',
    wordIds: ['w1'],
    sampleWordId: 'w1',
    files: [
      {
        kind: 'recording',
        wordId: 'w1',
        voice: 'anna',
        path: 'recordings/anna/plain/w1.a.mp3',
        url: 'https://m/r1',
        size: 3,
      },
      {
        kind: 'recording',
        wordId: 'w1',
        voice: 'boris',
        path: 'recordings/boris/plain/w1.b.mp3',
        url: 'https://m/r2',
        size: 3,
      },
      {
        kind: 'illustration',
        wordId: 'w1',
        path: 'illustrations/w1.c.png',
        url: 'https://m/i1',
        size: 4,
      },
    ],
  };

  it('holds no files before the build downloads them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'starter-'));
    expect(starterMediaFiles(dir)).toEqual({});
  });

  it('gives Metro every file downloaded, by Media Store path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'starter-'));
    const asked: string[] = [];
    const download = (url: string) => {
      asked.push(url);
      return Promise.resolve(new Uint8Array(url === 'https://m/i1' ? 4 : 3));
    };
    await downloadStarterMedia(list, dir, download);
    expect(starterMediaFiles(dir)).toEqual({
      'recordings/anna/plain/w1.a.mp3': join(dir, 'recordings/anna/plain/w1.a.mp3'),
      'recordings/boris/plain/w1.b.mp3': join(dir, 'recordings/boris/plain/w1.b.mp3'),
      'illustrations/w1.c.png': join(dir, 'illustrations/w1.c.png'),
    });
    // A second build downloads nothing it has.
    await downloadStarterMedia(list, dir, download);
    expect(asked).toHaveLength(3);
  });

  it('makes the folder when the Media Store holds no Starter Media yet', async () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'starter-')), 'starter-media');
    await downloadStarterMedia({ ...list, files: [] }, dir, () =>
      Promise.resolve(new Uint8Array()),
    );
    expect(starterMediaFiles(dir)).toEqual({});
    expect(existsSync(join(dir, 'list.json'))).toBe(true);
  });

  it('writes no list when a download ends short, so Metro bundles none of it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'starter-'));
    await expect(
      downloadStarterMedia(list, dir, () => Promise.resolve(new Uint8Array(1))),
    ).rejects.toThrow('ended at 1 of 3 bytes');
    expect(existsSync(join(dir, 'list.json'))).toBe(false);
    expect(starterMediaFiles(dir)).toEqual({});
  });

  it('gives Metro the Starter Words once the build listed them, none before', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'starter-'));
    expect(starterWordIds(dir)).toEqual([]);
    await downloadStarterMedia({ ...list, wordIds: ['w1', 'w2'], files: [] }, dir, () =>
      Promise.resolve(new Uint8Array()),
    );
    expect(starterWordIds(dir)).toEqual(['w1', 'w2']);
  });
});
