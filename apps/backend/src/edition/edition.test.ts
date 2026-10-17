import { describe, expect, it, onTestFinished } from 'vitest';

import { editionsFolder, testApp } from '../test-support';
import { readEditions } from './edition-folders';

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
