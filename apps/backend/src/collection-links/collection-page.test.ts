import { randomInt } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { testApp, testEditions } from '../test-support';

const HTML = { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' };

/** A Collection name no other test shares, since the tests of the file share its database. */
const newName = () => `Осінь <${String(randomInt(1_000_000_000))}>`;

/** The page's text with its tags left out, as a reader sees it, one line per element. */
const textOf = (page: string) =>
  page
    .replace(/<style>[^<]*<\/style>/, '')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => line.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"'));

describe('the web page of a Collection Link', () => {
  /**
   * A backend serving a copy of the UA Edition under the id with its
   * pack published, and a link shared on it.
   */
  async function shared(entryIds: string[], edition = 'uk') {
    const folder = testEditions([edition]);
    const pack = folder.buildPack(edition);
    const backend = testApp({ editions: folder.read() });
    await backend.publish(pack);
    const name = newName();
    const { id } = await backend.client.collectionLinks.create({ edition, name, entryIds });
    return { ...backend, id, name, edition };
  }

  it('shows a browser the Collection: its name and its Entries by kind, with Stress and the first Definition', async () => {
    const { request, id, name } = await shared([
      'r_2yrcze',
      'w_00g2ap',
      'i_25u9l7',
      'c_0ci49m',
      't_18wszq',
    ]);

    const response = await request(`/uk/c/${id}`, { headers: HTML });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^text\/html; charset=utf-8/i);
    const page = await response.text();
    expect(page).toContain('<html lang="uk-UA">');
    expect(page).not.toContain('<script');
    expect(textOf(page)).toEqual([
      `Колекція «${name}» у SLOVO`,
      name,
      'Колекція така, якою була, коли нею поділилися.',
      'Слова',
      'кракелю́р',
      'Тріщинки, які з часом утворюються на витворах мистецтва, перев. в олійному живописі, а також на кераміці.',
      'Виправлення',
      'чергови́й',
      'У слові «чергови́й» наголос падає на закінчення в усіх формах: чергова́, чергове́, чергово́го. Форма «черго́вий» — помилка.',
      'Фразеологізми',
      'Київ',
      'Столиця України, на Дніпрі.',
      'Синонімічні ряди',
      'боло́то',
      'Грузьке місце, просякнуте застояною водою.',
      'Поради',
      'Два, три, чотири студенти',
      'Після числівників «два», «три», «чотири» та «обидва» іменник стоїть у називному відмінку множини: два студенти, три брати, чотири олівці, обидва береги. Форма «два студента» — вплив російської мови.',
      'Відкрити в SLOVO',
      'SLOVO поки що в бета-тестуванні: застосунок можна встановити через TestFlight.',
    ]);
    expect(page).toContain(`<a href="slovo://uk/c/${id}">Відкрити в SLOVO</a>`);
  });

  it('lists only the Entries the published pack has', async () => {
    const { request, id } = await shared(['w_00g2ap', 'w_zzzzzz']);

    const page = await (await request(`/uk/c/${id}`, { headers: HTML })).text();

    expect(textOf(page)).toContain('кракелю́р');
    expect(page).not.toContain('w_zzzzzz');
  });

  it('answers an unknown link with a page that says it is not available, 404', async () => {
    const { request } = testApp();

    const response = await request('/uk/c/Unknown123', { headers: HTML });

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toMatch(/^text\/html/);
    const page = await response.text();
    expect(page).toContain('<html lang="uk-UA">');
    expect(textOf(page)).toContain('Цього посилання більше немає.');
  });

  it('answers a malformed id with the same page, 400', async () => {
    const { request } = testApp();

    const response = await request('/uk/c/short', { headers: HTML });

    expect(response.status).toBe(400);
    expect(textOf(await response.text())).toContain('Цього посилання більше немає.');
  });

  it('answers a link of an Edition with Collection Links switched off as not available', async () => {
    // The remote switch stays in the database the tests of the file share.
    const { request, id, switchOff } = await shared(['w_00g2ap'], 'switched');
    await switchOff('switched', 'collectionLinks');

    const response = await request(`/switched/c/${id}`, { headers: HTML });

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('кракелю́р');
  });

  it('answers a link under the path of another Edition as not available there, 404', async () => {
    const { request, id } = await shared(['w_00g2ap'], 'other');

    const response = await request(`/uk/c/${id}`, { headers: HTML });

    expect(response.status).toBe(404);
    const page = await response.text();
    expect(page).not.toContain('кракелю́р');
    expect(textOf(page)).toContain('Цього посилання більше немає.');
  });

  it('serves no link under a path that names no Edition', async () => {
    const { request, id } = await shared(['w_00g2ap']);

    const response = await request(`/xx/c/${id}`, { headers: HTML });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('keeps the JSON answer for a client that asks for JSON', async () => {
    const { request, id, name } = await shared(['w_00g2ap']);

    const response = await request(`/uk/c/${id}`, { headers: { accept: 'application/json' } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ edition: 'uk', name, entryIds: ['w_00g2ap'] });
    const unknown = await request('/uk/c/Unknown123', { headers: { accept: 'application/json' } });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({ code: 'NOT_FOUND' });
  });
});
