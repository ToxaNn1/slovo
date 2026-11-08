import { describe, expect, it, vi } from 'vitest';

import { postHogAnalytics, postHogOptions, type PostHogClient } from './posthog-analytics';

/** A PostHog client that keeps what it was given. */
function fakeClient() {
  const captured: unknown[][] = [];
  const personProperties: unknown[][] = [];
  const identified: string[] = [];
  let distinctId = 'posthog-made';
  const client: PostHogClient & { optedOut: boolean } = {
    optedOut: false,
    getDistinctId: () => distinctId,
    identify: (id) => {
      if (id !== undefined) distinctId = id;
      identified.push(id ?? '');
    },
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
  return { client, captured, personProperties, identified };
}

const seen = { entryKind: 'word', rarity: 4, categoryId: 'human-body' } as const;

/** The test device, with no switch under test. */
const reader = { distinctId: 'install-1', variants: {} };

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
    analytics.track('seen', seen, reader);

    expect(create).toHaveBeenCalledWith('phc_test');
    expect(captured).toEqual([['seen', seen]]);
  });

  it('keeps each questionnaire answer as a person property of the reader', () => {
    const { client, captured, personProperties } = fakeClient();
    const analytics = postHogAnalytics('phc_test', () => client);

    analytics.track('questionnaireAnswered', { question: 'level', answer: 'good' }, reader);
    analytics.track('questionnaireAnswered', { question: 'why', answer: 'curiosity' }, reader);

    expect(captured).toEqual([
      ['questionnaireAnswered', { question: 'level', answer: 'good' }],
      ['questionnaireAnswered', { question: 'why', answer: 'curiosity' }],
    ]);
    expect(personProperties).toEqual([
      [{ questionnaire_level: 'good' }, undefined, false],
      [{ questionnaire_why: 'curiosity' }, undefined, false],
    ]);
  });

  it('sets no person property for any other event', () => {
    const { client, personProperties } = fakeClient();
    const analytics = postHogAnalytics('phc_test', () => client);

    analytics.track('seen', seen, reader);
    analytics.track('laterQuestionAnswered', { question: 'wordGoalChoice', answer: '10' }, reader);

    expect(personProperties).toEqual([]);
  });

  it('opts out when sharing is turned off and back in at the next event', () => {
    const { client, captured } = fakeClient();
    const analytics = postHogAnalytics('phc_test', () => client);
    analytics.track('seen', seen, reader);

    analytics.stop();
    expect(client.optedOut).toBe(true);

    analytics.track('screenViewed', { screen: 'feed' }, reader);
    expect(client.optedOut).toBe(false);
    expect(captured).toHaveLength(2);
  });

  it('names the reader by the Install id once and sends the Variants with each event', () => {
    const { client, captured, identified } = fakeClient();
    const analytics = postHogAnalytics('phc_test', () => client);
    const testing = { distinctId: 'install-1', variants: { variant_gameTimed: 'b' } };

    analytics.track('seen', seen, testing);
    analytics.track('screenViewed', { screen: 'feed' }, testing);

    expect(identified).toEqual(['install-1']);
    expect(captured).toEqual([
      ['seen', { ...seen, variant_gameTimed: 'b' }],
      ['screenViewed', { screen: 'feed', variant_gameTimed: 'b' }],
    ]);
  });

  it('makes no client without a key', () => {
    const create = vi.fn(() => fakeClient().client);
    postHogAnalytics(undefined, create).track('seen', seen, reader);

    expect(create).not.toHaveBeenCalled();
  });
});
