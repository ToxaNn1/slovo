import { describe, expect, it } from 'vitest';

import { testApp, testEditions } from '../test-support';

const PATH = '/.well-known/apple-app-site-association';

describe('the apple-app-site-association file', () => {
  it('lists the app of every Edition with a Team ID for its Collection Links, under that Team ID', async () => {
    const teamIds: Record<string, string> = { uk: 'ABCDE12345', pl: 'FGHIJ67890', de: '' };
    const editions = testEditions(['uk', 'pl', 'de'], (config) => ({
      ...config,
      bundleId: `app.slovo.${config.id}`,
      appleTeamId: teamIds[config.id] ?? '',
    }));
    const { request } = testApp({ editions: editions.read() });

    const response = await request(PATH);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    // The Editions come in the order the backend finds their folders.
    const details = [
      { appIDs: ['ABCDE12345.app.slovo.uk'], components: [{ '/': '/c/*' }] },
      { appIDs: ['FGHIJ67890.app.slovo.pl'], components: [{ '/': '/c/*' }] },
    ];
    const file: unknown = await response.json();
    expect(Object.keys(file ?? {})).toEqual(['applinks']);
    expect(file).toHaveProperty('applinks.details', expect.arrayContaining(details));
    expect(file).toHaveProperty('applinks.details.length', details.length);
  });

  it('is not there while no Edition has a Team ID', async () => {
    const editions = testEditions(['uk'], (config) => ({ ...config, appleTeamId: '' }));
    const { request } = testApp({ editions: editions.read() });

    const response = await request(PATH);

    expect(response.status).toBe(404);
  });
});
