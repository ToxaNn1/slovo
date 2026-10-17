import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { EDITIONS_DIR, editionFiles, openEdition } from '@slovo/language-pack/edition';
import { describe, expect, it, onTestFinished } from 'vitest';

import { testApp } from '../test-support';
import { readEditions } from './edition-folders';

/**
 * An editions folder with an Edition for each id, each a copy of the
 * Ukrainian Edition's config, strings and content manifest under its own id.
 */
function editionsFolder(ids: readonly string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-editions-'));
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  const ukrainian = openEdition(EDITIONS_DIR, 'uk');
  for (const id of ids) {
    const edition = editionFiles(join(dir, id));
    mkdirSync(dirname(edition.path('manifest')), { recursive: true });
    copyFileSync(ukrainian.path('strings'), edition.path('strings'));
    copyFileSync(ukrainian.path('manifest'), edition.path('manifest'));
    const config = JSON.parse(readFileSync(ukrainian.path('config'), 'utf8')) as object;
    writeFileSync(edition.path('config'), JSON.stringify({ ...config, id }));
  }
  return dir;
}

describe('the Editions', () => {
  it('are every Edition folder the backend finds at start', async () => {
    const { client, close } = testApp({ editions: readEditions(editionsFolder(['uk', 'pl'])) });
    onTestFinished(close);

    for (const editionId of ['uk', 'pl']) {
      await expect(client.content.latest({ editionId, packFormat: 1 })).resolves.toEqual({
        pack: null,
      });
    }
  });

  it('refuse an Edition the backend did not find as NOT_FOUND', async () => {
    const { client, close } = testApp({ editions: readEditions(editionsFolder(['uk'])) });
    onTestFinished(close);

    await expect(client.content.latest({ editionId: 'pl', packFormat: 1 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
      defined: true,
    });
  });
});
