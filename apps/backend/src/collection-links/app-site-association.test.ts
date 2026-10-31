import { describe, expect, it } from 'vitest';

import { testApp, testAppConfig } from '../test-support';

const PATH = '/.well-known/apple-app-site-association';

describe('the apple-app-site-association file', () => {
  it("names the one app for each Edition's Collection Links once, under the AppConfig's Team ID and bundle id", async () => {
    const app = { ...testAppConfig, appleTeamId: 'ABCDE12345', bundleId: 'app.slovo.uk' };
    const { request } = testApp({ app });

    const response = await request(PATH);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toEqual({
      applinks: {
        details: [{ appIDs: ['ABCDE12345.app.slovo.uk'], components: [{ '/': '/uk/c/*' }] }],
      },
    });
  });

  it('is not there while the app has no Team ID', async () => {
    const { request } = testApp({ app: { ...testAppConfig, appleTeamId: '' } });

    const response = await request(PATH);

    expect(response.status).toBe(404);
  });
});
