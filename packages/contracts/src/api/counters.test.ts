import { describe, expect, it } from 'vitest';

import { createApiClient } from '../api';
import { serveApi } from './test-support';

/** A batch of counter events as the app sends it: a new mark with a Favorite, and a move. */
const EVENTS = {
  editionId: 'uk',
  events: [
    { entryId: 'w_abc123', known: 1, unknown: 0, saved: 1 },
    { entryId: 'c_abc123', known: -1, unknown: 1, saved: 0 },
  ],
} as const;

/** A backend that keeps what each counters procedure it serves was asked. */
function backend() {
  const received: unknown[] = [];
  const serve = serveApi({
    counters: {
      send: ({ input }) => {
        received.push(input);
      },
      read: ({ input }) => {
        received.push(input);
        return {
          counters: input.entries.map((entryId) => ({ entryId, known: 3, unknown: 2, saved: 0 })),
        };
      },
      communityWord: ({ input }) => {
        received.push(input);
        return { communityWord: { entryId: 'w_abc123', adds: 7 } };
      },
    },
  });
  /** Sends `body` as JSON to `POST /v1/counters/events`, as any client may. */
  const post = (body: object) =>
    serve(
      new Request('http://backend.test/v1/counters/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  /** Asks `GET <path>?<query>`, as any client may. */
  const get = (path: string, query: string) =>
    serve(new Request(`http://backend.test${path}?${query}`));
  const api = createApiClient({ url: 'http://backend.test', fetch: serve });
  return { api, post, get, received };
}

describe('POST /v1/counters/events', () => {
  it('takes valid events with 202 and no body', async () => {
    const { post, received } = backend();

    const response = await post(EVENTS);

    expect(response.status).toBe(202);
    expect(await response.text()).toBe('');
    expect(received).toEqual([EVENTS]);
  });

  it('takes every change one Entry can make, of each kind of Entry', async () => {
    const { api, received } = backend();
    const changes = [
      { known: 1, unknown: 0, saved: 0 },
      { known: 0, unknown: 1, saved: 0 },
      { known: -1, unknown: 0, saved: 0 },
      { known: 0, unknown: -1, saved: 0 },
      { known: 1, unknown: -1, saved: 0 },
      { known: -1, unknown: 1, saved: 0 },
      { known: 0, unknown: 0, saved: 1 },
      { known: 0, unknown: 0, saved: -1 },
    ] as const;
    const kinds = ['w', 'c', 'i', 'r', 't'];
    const events = kinds.flatMap((kind) =>
      changes.map((change, index) => ({ entryId: `${kind}_a${String(index)}`, ...change })),
    );

    await api.counters.send({ editionId: 'uk', events });

    expect(received).toEqual([{ editionId: 'uk', events }]);
  });

  it('takes 100 events', async () => {
    const { api, received } = backend();
    const events = Array.from({ length: 100 }, (_, index) => ({
      entryId: `w_a${String(index)}`,
      known: 1 as const,
      unknown: 0 as const,
      saved: 0 as const,
    }));

    await api.counters.send({ editionId: 'uk', events });

    expect(received).toEqual([{ editionId: 'uk', events }]);
  });

  const event = EVENTS.events[0];
  it.each([
    ['no events', { events: [] }],
    [
      '101 events',
      {
        events: Array.from({ length: 101 }, (_, index) => ({
          ...event,
          entryId: `w_a${String(index)}`,
        })),
      },
    ],
    ['one Entry twice', { events: [event, { ...event, known: 0 }] }],
    ['an event that changes nothing', { events: [{ ...event, known: 0, saved: 0 }] }],
    ['a change of 2', { events: [{ ...event, known: 2 }] }],
    ['a change that is no whole number', { events: [{ ...event, known: 0.5 }] }],
    ['both marks added at once', { events: [{ ...event, unknown: 1 }] }],
    ['both marks removed at once', { events: [{ ...event, known: -1, unknown: -1 }] }],
    ['an event with no saved field', { events: [{ entryId: 'w_a1', known: 1, unknown: 0 }] }],
    ['an id that names no Entry', { events: [{ ...event, entryId: 'x_a1' }] }],
    ['an Edition id that is no id', { editionId: 'UK' }],
    ['a device id', { deviceId: 'd_1' }],
    ['an Account', { events: [{ ...event, accountId: 'a_1' }] }],
  ])('refuses %s with 400 BAD_REQUEST', async (_case, change) => {
    const { post, received } = backend();

    const response = await post({ ...EVENTS, ...change });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'BAD_REQUEST' });
    expect(received).toEqual([]);
  });
});

describe('GET /v1/counters', () => {
  it('answers the counters of each Entry asked, in the order asked', async () => {
    const { get, received } = backend();

    const response = await get('/v1/counters', 'edition=uk&entries=w_b2,c_a1,i_a1');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      counters: [
        { entryId: 'w_b2', known: 3, unknown: 2, saved: 0 },
        { entryId: 'c_a1', known: 3, unknown: 2, saved: 0 },
        { entryId: 'i_a1', known: 3, unknown: 2, saved: 0 },
      ],
    });
    expect(received).toEqual([{ edition: 'uk', entries: ['w_b2', 'c_a1', 'i_a1'] }]);
  });

  it('is asked through the client with 100 Entries', async () => {
    const { api, received } = backend();
    const entries = Array.from({ length: 100 }, (_, index) => `r_a${String(index)}`);

    const { counters } = await api.counters.read({ edition: 'uk', entries: entries.join(',') });

    expect(counters.map((counter) => counter.entryId)).toEqual(entries);
    expect(received).toEqual([{ edition: 'uk', entries }]);
  });

  it.each([
    [
      '101 Entries',
      `edition=uk&entries=${Array.from({ length: 101 }, (_, i) => `w_a${String(i)}`).join(',')}`,
    ],
    ['no Entries', 'edition=uk&entries='],
    ['no entries field', 'edition=uk'],
    ['one Entry twice', 'edition=uk&entries=w_a1,w_a1'],
    ['an id that names no Entry', 'edition=uk&entries=w_a1,x_a1'],
    ['no Edition', 'entries=w_a1'],
    ['an Edition id that is no id', 'edition=UK&entries=w_a1'],
    ['an unknown field', 'edition=uk&entries=w_a1&device=d_1'],
  ])('refuses %s with 400 BAD_REQUEST', async (_case, query) => {
    const { get, received } = backend();

    const response = await get('/v1/counters', query);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'BAD_REQUEST' });
    expect(received).toEqual([]);
  });
});

describe('GET /v1/community/week', () => {
  it('answers the Community Word of the last ISO week with its adds', async () => {
    const { get, received } = backend();

    const response = await get('/v1/community/week', 'edition=uk');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ communityWord: { entryId: 'w_abc123', adds: 7 } });
    expect(received).toEqual([{ edition: 'uk' }]);
  });

  it('answers none when nobody added anything', async () => {
    const api = createApiClient({
      url: 'http://backend.test',
      fetch: serveApi({ counters: { communityWord: () => ({ communityWord: null }) } }),
    });

    expect(await api.counters.communityWord({ edition: 'uk' })).toEqual({ communityWord: null });
  });

  it.each([
    ['no Edition', ''],
    ['an Edition id that is no id', 'edition=UK'],
    ['an unknown field', 'edition=uk&week=2026-W43'],
  ])('refuses %s with 400 BAD_REQUEST', async (_case, query) => {
    const { get, received } = backend();

    const response = await get('/v1/community/week', query);

    expect(response.status).toBe(400);
    expect(received).toEqual([]);
  });
});
