import { describe, expect, it, onTestFinished } from 'vitest';

import { testApp } from '../test-support';

describe('content.latest', () => {
  it('answers none for the Ukrainian Edition while no pack is published', async () => {
    const { client, close } = testApp();
    onTestFinished(close);

    const latest = await client.content.latest({ editionId: 'uk', packFormat: 1 });

    expect(latest).toEqual({ pack: null });
  });

  it('refuses a request with an unknown field as BAD_REQUEST', async () => {
    const { client, close } = testApp();
    onTestFinished(close);
    // The contract's types allow no unknown field, so the test slips one past them.
    const input = { editionId: 'uk', packFormat: 1, since: 3 };

    await expect(client.content.latest(input)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
      defined: true,
    });
  });

  it('refuses a pack format that is not a positive whole number as BAD_REQUEST', async () => {
    const { client, close } = testApp();
    onTestFinished(close);

    await expect(client.content.latest({ editionId: 'uk', packFormat: 0 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      status: 400,
    });
  });
});
