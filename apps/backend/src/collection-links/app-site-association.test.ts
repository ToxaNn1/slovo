import { describe, expect, it } from 'vitest';

import { testApp, testEditions } from '../test-support';

const PATH = '/.well-known/apple-app-site-association';

describe('the apple-app-site-association file', () => {
  it('lists the app of every Edition for its Collection Links, under the Team ID', async () => {
    const editions = testEditions(['uk', 'pl'], (config) => ({
      ...config,
      bundleId: `app.slovo.${config.id}`,
    }));
    const { request } = testApp({ editions: editions.read(), appleTeamId: 'ABCDE12345' });

    const response = await request(PATH);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    // The Editions come in the order the backend finds their folders.
    const details = [
      { appIDs: ['ABCDE12345.app.slovo.uk'], components: [{ '/': '/c/*' }] },
      { appIDs: ['ABCDE12345.app.slovo.pl'], components: [{ '/': '/c/*' }] },
    ];
    const file: unknown = await response.json();
    expect(Object.keys(file ?? {})).toEqual(['applinks']);
    expect(file).toHaveProperty('applinks.details', expect.arrayContaining(details));
    expect(file).toHaveProperty('applinks.details.length', details.length);
  });

  it('is not there while the backend has no Team ID', async () => {
    const { request } = testApp();

    const response = await request(PATH);

    expect(response.status).toBe(404);
  });
});
