import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { readLiveWords, snapshotSource, type SnapshotReaders } from './snapshot';

const seed = snapshotSource({});
const seedJson: unknown = JSON.parse(seed.kind === 'seed' ? readFileSync(seed.file, 'utf8') : '{}');

const backendAnswering = (status: number, body: unknown): SnapshotReaders => ({
  fetch: (url) => {
    expect(url).toBe('https://api.example.org/v1/editions/uk/content/snapshot');
    return Promise.resolve({ ok: status === 200, status, json: () => Promise.resolve(body) });
  },
  readFile: () => {
    throw new Error('The seed is not read when the backend is set');
  },
});

describe('the content snapshot the site is built from', () => {
  it('comes from the seed snapshot when no backend is set', () => {
    expect(seed.kind === 'seed' ? seed.file : undefined).toMatch(
      /editions\/uk\/seed-snapshot\.json$/,
    );
  });

  it('comes from the backend when SLOVO_BACKEND_URL is set, and refuses an empty one', () => {
    expect(snapshotSource({ SLOVO_BACKEND_URL: 'https://api.example.org/' })).toEqual({
      kind: 'backend',
      url: 'https://api.example.org/v1/editions/uk/content/snapshot',
    });
    expect(() => snapshotSource({ SLOVO_BACKEND_URL: '' })).toThrow(/empty/);
  });

  it('gives the live Words of the seed, the Retired one left out', async () => {
    const words = await readLiveWords(seed);
    expect(words.length).toBeGreaterThan(100);
    expect(words.every((word) => !word.retired)).toBe(true);
    expect(words.map((word) => word.lemma)).toContain('кракелюр');
  });

  it('gives the live Words the backend serves', async () => {
    const source = snapshotSource({ SLOVO_BACKEND_URL: 'https://api.example.org' });
    const words = await readLiveWords(source, backendAnswering(200, seedJson));
    expect(words).toEqual(await readLiveWords(seed));
  });

  it('fails the build when the backend fails or answers what is no snapshot', async () => {
    const source = snapshotSource({ SLOVO_BACKEND_URL: 'https://api.example.org' });
    await expect(readLiveWords(source, backendAnswering(503, {}))).rejects.toThrow(/503/);
    await expect(readLiveWords(source, backendAnswering(200, { words: [] }))).rejects.toThrow();
  });
});
