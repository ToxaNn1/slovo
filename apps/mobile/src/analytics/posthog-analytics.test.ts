import { describe, expect, it, vi } from 'vitest';

import { postHogAnalytics, postHogOptions, type PostHogClient } from './posthog-analytics';

/** A PostHog client that keeps what it was given. */
function fakeClient() {
  const captured: unknown[][] = [];
  const client: PostHogClient & { optedOut: boolean } = {
    optedOut: false,
    capture: (event, properties) => {
      captured.push([event, properties]);
    },
    optIn: () => {
      client.optedOut = false;
      return Promise.resolve();
    },
    optOut: () => {
      client.optedOut = true;
      return Promise.resolve();
    },
  };
  return { client, captured };
}

const seen = { entryKind: 'word', rarity: 4, categoryId: 'human-body' } as const;

describe('The PostHog adapter', () => {
  it('sends to the EU host with no session recording, autocapture or location', () => {
    expect(postHogOptions).toMatchObject({
      host: 'https://eu.i.posthog.com',
      enableSessionReplay: false,
      captureAppLifecycleEvents: false,
      disableGeoip: true,
      flushAt: 1,
    });
  });

  it('makes no client until the first event, then captures it with its properties', () => {
    const { client, captured } = fakeClient();
    const create = vi.fn(() => client);
    const analytics = postHogAnalytics('phc_test', create);

    expect(create).not.toHaveBeenCalled();
    analytics.track('seen', seen);

    expect(create).toHaveBeenCalledWith('phc_test');
    expect(captured).toEqual([['seen', seen]]);
  });

  it('opts out when sharing is turned off and back in at the next event', () => {
    const { client, captured } = fakeClient();
    const analytics = postHogAnalytics('phc_test', () => client);
    analytics.track('seen', seen);

    analytics.stop();
    expect(client.optedOut).toBe(true);

    analytics.track('screenViewed', { screen: 'feed' });
    expect(client.optedOut).toBe(false);
    expect(captured).toHaveLength(2);
  });

  it('makes no client without a key', () => {
    const create = vi.fn(() => fakeClient().client);
    postHogAnalytics(undefined, create).track('seen', seen);

    expect(create).not.toHaveBeenCalled();
  });
});
