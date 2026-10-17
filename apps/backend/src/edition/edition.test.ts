import { describe, expect, it } from 'vitest';

import { testApp, testEditions } from '../test-support';

describe('the Editions', () => {
  it('are every Edition folder the backend finds at start', async () => {
    const { client } = testApp({ editions: testEditions(['uk', 'pl']).read() });

    for (const editionId of ['uk', 'pl']) {
      await expect(client.content.latest({ editionId, packFormat: 1 })).resolves.toEqual({
        pack: null,
      });
    }
  });

  it('refuse an Edition the backend did not find as NOT_FOUND', async () => {
    const { client } = testApp({ editions: testEditions(['uk']).read() });

    await expect(client.content.latest({ editionId: 'pl', packFormat: 1 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
      defined: true,
    });
  });
});
