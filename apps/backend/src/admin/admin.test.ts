import { randomInt, randomUUID } from 'node:crypto';

import type { EditionConfig } from '@slovo/contracts';
import { beforeEach, describe, expect, it } from 'vitest';

import { testApp, testEditions } from '../test-support';

const newEmail = () => `reader-${randomUUID()}@example.com`;

/** The owner's email, a new one each test, so no test reaches another's sign-in limits. */
let OWNER = '';
beforeEach(() => {
  OWNER = `owner-${randomUUID()}@example.com`;
});
const newEntryId = () => `w_${randomInt(2 ** 47).toString(36)}`;

/** A form post of the admin, with the admin's cookie when there is one. */
const form = (fields: Record<string, string>, cookie?: string): RequestInit => ({
  method: 'POST',
  body: new URLSearchParams(fields),
  headers: cookie === undefined ? {} : { cookie },
});

/** The page's text without its tags, one space between words. */
const textOf = async (response: Response) =>
  (await response.text())
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

type Backend = ReturnType<typeof testApp>;

/** Signs the email in through the admin's two forms; answers the cookie of the Session, if any. */
async function signIn(backend: Backend, email: string) {
  await backend.request('/admin/code', form({ email }));
  const signedIn = await backend.request(
    '/admin/sign-in',
    form({ email, code: backend.mailer.codeSentTo(email) }),
  );
  return {
    status: signedIn.status,
    cookie: signedIn.headers.get('set-cookie')?.split(';')[0],
  };
}

/** The backend with the owner's email set, and the owner's cookie once signed in. */
async function ownerSignedIn(editions?: Parameters<typeof testApp>[0]) {
  const backend = testApp({ ...editions, ownerEmail: OWNER });
  const { cookie } = await signIn(backend, OWNER);
  if (cookie === undefined) throw new Error('the owner was not signed in');
  return { ...backend, cookie, page: () => backend.request('/admin', { headers: { cookie } }) };
}

describe('the owner admin sign-in', () => {
  it('signs the owner in with a Sign-in code and shows the admin', async () => {
    const backend = testApp({ ownerEmail: OWNER });

    const { status, cookie } = await signIn(backend, OWNER);
    const page = await backend.request('/admin', { headers: { cookie: cookie ?? '' } });

    expect(status).toBe(303);
    expect(page.status).toBe(200);
    await expect(textOf(page)).resolves.toContain('Mistake Reports');
  });

  it('sends no code to any other email and signs it in nowhere', async () => {
    const backend = testApp({ ownerEmail: OWNER });
    const stranger = newEmail();

    const asked = await backend.request('/admin/code', form({ email: stranger }));
    const tried = await backend.request(
      '/admin/sign-in',
      form({ email: stranger, code: '123456' }),
    );

    expect(asked.status).toBe(403);
    expect(tried.status).toBe(403);
    expect(tried.headers.get('set-cookie')).toBeNull();
    expect(backend.mailer.sent.filter((mail) => mail.to === stranger)).toEqual([]);
  });

  it('refuses the Session of another Account, signed in through the app', async () => {
    const backend = testApp({ ownerEmail: OWNER });
    const reader = newEmail();
    await backend.client.account.requestCode({ email: reader, editionId: 'uk' });
    const { token } = await backend.client.account.verifyCode({
      email: reader,
      code: backend.mailer.codeSentTo(reader),
    });
    const cookie = `slovo_admin=${token}`;

    const page = await backend.request('/admin', { headers: { cookie } });
    const switched = await backend.request(
      '/admin/switches',
      form({ edition: 'uk', feature: 'sync', action: 'off' }, cookie),
    );

    expect(page.status).toBe(403);
    await expect(textOf(page)).resolves.not.toContain('Mistake Reports');
    expect(switched.status).toBe(403);
    await expect(
      backend.client.edition.switches({ params: { editionId: 'uk' } }),
    ).resolves.toMatchObject({ body: { off: [] } });
  });

  it('shows the sign-in form alone without a Session', async () => {
    const backend = testApp({ ownerEmail: OWNER });

    const page = await backend.request('/admin');

    expect(page.status).toBe(401);
    const text = await textOf(page);
    expect(text).toContain('Email');
    expect(text).not.toContain('Mistake Reports');
  });

  it('is absent while the backend has no owner email', async () => {
    const backend = testApp();

    expect((await backend.request('/admin')).status).toBe(404);
    expect((await backend.request('/admin/code', form({ email: OWNER }))).status).toBe(404);
  });

  it('signs the owner out', async () => {
    const { request, cookie } = await ownerSignedIn();

    await request('/admin/sign-out', form({}, cookie));

    expect((await request('/admin', { headers: { cookie } })).status).toBe(401);
  });
});

describe('the remote switches of the owner admin', () => {
  it('turns a feature off in an Edition, and clears it again', async () => {
    const { request, cookie, client } = await ownerSignedIn({
      editions: testEditions(['switched']).read(),
    });
    const off = () => client.edition.switches({ params: { editionId: 'switched' } });

    const turned = await request(
      '/admin/switches',
      form({ edition: 'switched', feature: 'sync', action: 'off' }, cookie),
    );
    expect(turned.status).toBe(303);
    await expect(off()).resolves.toMatchObject({ body: { off: ['sync'] } });

    await request(
      '/admin/switches',
      form({ edition: 'switched', feature: 'sync', action: 'clear' }, cookie),
    );
    await expect(off()).resolves.toMatchObject({ body: { off: [] } });
  });

  it('never turns on a feature the Edition has off', async () => {
    const shippedOff = (config: EditionConfig): EditionConfig => ({
      ...config,
      featureSwitches: { ...config.featureSwitches, mistakeReports: false },
    });
    const { request, cookie, client, page } = await ownerSignedIn({
      editions: testEditions(['shipped-off'], shippedOff).read(),
    });

    const cleared = await request(
      '/admin/switches',
      form({ edition: 'shipped-off', feature: 'mistakeReports', action: 'clear' }, cookie),
    );
    const turnedOn = await request(
      '/admin/switches',
      form({ edition: 'shipped-off', feature: 'mistakeReports', action: 'on' }, cookie),
    );

    expect(cleared.status).toBe(400);
    expect(turnedOn.status).toBe(400);
    await expect(
      client.reports.send({
        editionId: 'shipped-off',
        entryId: newEntryId(),
        type: 'typo',
        comment: '',
        appVersion: '1.0.0',
        contentVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const shown = await (await page()).text();
    expect(shown).toMatch(/mistakeReports[^<]*<\/td>\s*<td>off in the Edition<\/td>/);
  });

  it('refuses an Edition or a feature it does not know', async () => {
    const { request, cookie } = await ownerSignedIn();

    const edition = await request(
      '/admin/switches',
      form({ edition: 'nowhere', feature: 'sync', action: 'off' }, cookie),
    );
    const feature = await request(
      '/admin/switches',
      form({ edition: 'uk', feature: 'teleport', action: 'off' }, cookie),
    );

    expect(edition.status).toBe(400);
    expect(feature.status).toBe(400);
  });
});

describe('the summary of the owner admin', () => {
  it('counts the Accounts, the Community Counters and the questionnaire counters live', async () => {
    const { client, mailer, page } = await ownerSignedIn({
      editions: testEditions(['uk', 'summed']).read(),
    });
    const accountsShown = async () =>
      Number(/Accounts: (\d+)/.exec(await textOf(await page()))?.[1]);
    const before = await accountsShown();
    const reader = newEmail();
    await client.account.requestCode({ email: reader, editionId: 'uk' });
    await client.account.verifyCode({ email: reader, code: mailer.codeSentTo(reader) });
    const [first, second] = [newEntryId(), newEntryId()];
    await client.counters.send({
      editionId: 'summed',
      events: [
        { entryId: first, known: 1, unknown: 0, saved: 1 },
        { entryId: second, known: 0, unknown: 1, saved: 0 },
      ],
    });
    await client.counters.questionnaire({
      editionId: 'summed',
      question: 'who',
      answer: 'studying',
    });
    await client.counters.questionnaire({
      editionId: 'summed',
      question: 'who',
      answer: 'studying',
    });

    const text = await textOf(await page());

    expect(await accountsShown()).toBe(before + 1);
    expect(text).toContain('summed 2 1 1 1');
    expect(text).toContain('summed who studying 2');
    expect(text).toContain('PostHog');
    expect(text).toContain('App Store Connect');
  });
});

describe('the Mistake Report inbox of the owner admin', () => {
  it('shows each kept report and resolves it', async () => {
    const { client, page, request, cookie, listReports } = await ownerSignedIn();
    const entryId = newEntryId();
    await client.reports.send({
      editionId: 'uk',
      entryId,
      type: 'stress',
      comment: 'The Stress <falls> on the third syllable.',
      appVersion: '1.0.0',
      contentVersion: 7,
    });
    const shown = await (await page()).text();
    const id = /name="id" value="([0-9a-f-]{36})"/.exec(shown)?.[1] ?? '';

    expect(shown).toContain(entryId);
    expect(shown).toContain('The Stress &lt;falls&gt; on the third syllable.');

    const resolved = await request('/admin/reports/resolve', form({ id }, cookie));

    expect(resolved.status).toBe(303);
    await expect(textOf(await page())).resolves.not.toContain(entryId);
    await expect(listReports()).resolves.not.toContain(expect.stringContaining(entryId));
  });
});
