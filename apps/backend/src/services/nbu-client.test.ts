import { describe, expect, it } from 'vitest';

import { createNbuClient } from './nbu-client';

/** A fetch that answers every request the body with the status, and keeps the URLs asked. */
function fetchAnswering(status: number, body: unknown) {
  const asked: string[] = [];
  const fetch: typeof globalThis.fetch = (input) => {
    asked.push(input instanceof Request ? input.url : String(input));
    return Promise.resolve(Response.json(body, { status }));
  };
  return { asked, fetch };
}

describe('the NBU client', () => {
  it("reads the day's dollar rate from the NBU's page of that day", async () => {
    const { asked, fetch } = fetchAnswering(200, [
      { r030: 840, txt: 'Долар США', rate: 41.4321, cc: 'USD', exchangedate: '17.11.2026' },
    ]);

    expect(await createNbuClient(fetch).usdRate('2026-11-17')).toEqual({
      ok: true,
      rate: { uahPerUsd: 41.4321, on: '2026-11-17' },
    });
    expect(asked).toEqual([
      'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=USD&date=20261117&json',
    ]);
  });

  it('answers that it cannot on a refusal, an empty answer or no network', async () => {
    expect(await createNbuClient(fetchAnswering(503, {}).fetch).usdRate('2026-11-17')).toEqual({
      ok: false,
    });
    expect(await createNbuClient(fetchAnswering(200, []).fetch).usdRate('2026-11-17')).toEqual({
      ok: false,
    });
    const offline: typeof globalThis.fetch = () => Promise.reject(new TypeError('fetch failed'));
    expect(await createNbuClient(offline).usdRate('2026-11-17')).toEqual({ ok: false });
  });
});
