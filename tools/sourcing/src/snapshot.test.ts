import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { UK_SEED_SNAPSHOT } from './test-support';
import { contentSnapshot } from './snapshot';

const seed = readFileSync(UK_SEED_SNAPSHOT, 'utf8');

describe('contentSnapshot', () => {
  it('reads a snapshot saved to a file', async () => {
    const result = await contentSnapshot({
      editionId: 'uk',
      file: UK_SEED_SNAPSHOT,
      apiUrl: undefined,
    });

    expect(result.ok && result.snapshot.words.length).toBeGreaterThan(0);
  });

  it('asks the backend at the API URL, /v1 or not, when no file is named', async () => {
    const asked: string[] = [];
    const result = await contentSnapshot({
      editionId: 'uk',
      file: undefined,
      apiUrl: 'https://api.slovo.test/v1',
      fetch: (request) => {
        asked.push(request.url);
        return Promise.resolve(
          new Response(seed, { status: 200, headers: { 'content-type': 'application/json' } }),
        );
      },
    });

    expect(asked).toEqual(['https://api.slovo.test/v1/editions/uk/content/snapshot']);
    expect(result.ok && result.snapshot.contentVersion).toBeGreaterThan(0);
  });

  it('fails loudly, never with an empty snapshot, when neither a file nor an API URL is given', async () => {
    for (const apiUrl of [undefined, '']) {
      expect(await contentSnapshot({ editionId: 'uk', file: undefined, apiUrl })).toEqual({
        ok: false,
        error:
          'No content snapshot of Edition uk: pass --snapshot <file> or set SLOVO_API_URL to the backend',
      });
    }
  });

  it('fails when the file is no snapshot, or of another Edition', async () => {
    const notSnapshot = await contentSnapshot({
      editionId: 'uk',
      file: new URL('../package.json', import.meta.url).pathname,
      apiUrl: undefined,
    });
    const otherEdition = await contentSnapshot({
      editionId: 'pl',
      file: UK_SEED_SNAPSHOT,
      apiUrl: undefined,
    });

    expect(notSnapshot.ok).toBe(false);
    expect(otherEdition).toEqual({ ok: false, error: 'The snapshot is of Edition uk, not pl' });
  });

  it('fails when the backend gives no snapshot', async () => {
    const result = await contentSnapshot({
      editionId: 'uk',
      file: undefined,
      apiUrl: 'https://api.slovo.test',
      fetch: () => Promise.resolve(new Response('down', { status: 503 })),
    });

    expect(result.ok ? '' : result.error).toMatch(/^No content snapshot of Edition uk from /);
  });
});
