import { describe, expect, it, vi } from 'vitest';

import { postHogAnalytics, postHogOptions, type PostHogClient } from './posthog-analytics';

/** A PostHog client that keeps what it was given. */
function fakeClient() {
  const captured: unknown[][] = [];
  const personProperties: unknown[][] = [];
  const client: PostHogClient & { optedOut: boolean } = {
    optedOut: false,
    capture: (event, properties) => {
      captured.push([event, properties]);
    },
    setPersonProperties: (...args) => {
      personProperties.push(args);
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
  return { client, captured, personProperties };
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

  it('keeps each questionnaire answer as a person property of the anonymous id', () => {
    const { client, captured, personProperties } = fakeClient();
    const analytics = postHogAnalytics('phc_test', () => client);

    analytics.track('questionnaireAnswered', { question: 'who', answer: 'student' });
    analytics.track('questionnaireAnswered', { question: 'why', answer: 'curiosity' });

    expect(captured).toEqual([
      ['questionnaireAnswered', { question: 'who', answer: 'student' }],
      ['questionnaireAnswered', { question: 'why', answer: 'curiosity' }],
    ]);
    expect(personProperties).toEqual([
      [{ questionnaire_who: 'student' }, undefined, false],
      [{ questionnaire_why: 'curiosity' }, undefined, false],
    ]);
  });

  it('sets no person property for any other event', () => {
    const { client, personProperties } = fakeClient();
    const analytics = postHogAnalytics('phc_test', () => client);

    analytics.track('seen', seen);
    analytics.track('laterQuestionAnswered', { question: 'dailyGoalChoice', answer: '10' });

    expect(personProperties).toEqual([]);
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
