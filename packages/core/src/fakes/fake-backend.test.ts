import { describe, expect, it } from 'vitest';

import { createFakeBackend, signInByCode, type FakeBackend } from './fake-backend';

/** Signs the email in by a Sign-in code, as the app does; the Session token. */
async function signIn(fake: FakeBackend, email: string): Promise<string> {
  return (await signInByCode(fake, email)).token;
}

function push(fake: FakeBackend, token: string, key: string) {
  return fake.backend.sync.push(
    { editionId: 'uk', changes: [{ key, value: true, changedAt: 1 }] },
    { context: { token } },
  );
}

async function pulledKeys(fake: FakeBackend, token: string): Promise<string[]> {
  const page = await fake.backend.sync.pull({ editionId: 'uk' }, { context: { token } });
  return page.records.map(({ key }) => key);
}

describe('the fake backend’s Sync', () => {
  it('answers 401 to a push or pull with no Session, or one ended elsewhere', async () => {
    const fake = createFakeBackend();
    const token = await signIn(fake, 'anna@mail.com');
    await push(fake, token, 'favorites.w_one');

    fake.account.endSessions();

    await expect(push(fake, token, 'favorites.w_two')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(fake.backend.sync.pull({ editionId: 'uk' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect([...fake.sync.recordsOf('anna@mail.com').keys()]).toEqual(['favorites.w_one']);
  });

  it('keeps each Account its own records, on one sequence', async () => {
    const fake = createFakeBackend();
    const anna = await signIn(fake, 'anna@mail.com');
    const olha = await signIn(fake, 'olha@mail.com');
    await push(fake, anna, 'favorites.w_one');
    await push(fake, olha, 'favorites.w_two');

    expect(await pulledKeys(fake, anna)).toEqual(['favorites.w_one']);
    expect(await pulledKeys(fake, olha)).toEqual(['favorites.w_two']);
    expect(fake.sync.recordsOf('olha@mail.com').get('favorites.w_two')?.sequence).toBe(2);
  });

  it('drops the records of a deleted Account, so its email signs in again to none', async () => {
    const fake = createFakeBackend();
    const before = await signIn(fake, 'anna@mail.com');
    await push(fake, before, 'favorites.w_one');

    await fake.backend.account.delete(undefined, { context: { token: before } });
    const after = await signIn(fake, 'anna@mail.com');

    expect(await pulledKeys(fake, after)).toEqual([]);
    expect([...fake.sync.recordsOf('anna@mail.com').keys()]).toEqual([]);
  });
});

describe('the fake backend’s Sign-in code', () => {
  it('answers CODE_SPENT on the fifth wrong try, and to every try after it until a new code', async () => {
    const fake = createFakeBackend();
    const email = 'anna@mail.com';
    await fake.backend.account.requestCode({ email, editionId: 'uk' });
    const code = fake.account.sentCodes.at(-1)?.code ?? '';

    for (const triesLeft of [4, 3, 2, 1]) {
      await expect(
        fake.backend.account.verifyCode({ email, code: '999999' }),
      ).rejects.toMatchObject({ code: 'WRONG_CODE', data: { triesLeft } });
    }
    await expect(fake.backend.account.verifyCode({ email, code: '999999' })).rejects.toMatchObject({
      code: 'CODE_SPENT',
      status: 429,
    });
    await expect(fake.backend.account.verifyCode({ email, code })).rejects.toMatchObject({
      code: 'CODE_SPENT',
    });

    await fake.backend.account.requestCode({ email, editionId: 'uk' });
    const fresh = fake.account.sentCodes.at(-1)?.code ?? '';
    await expect(fake.backend.account.verifyCode({ email, code: fresh })).resolves.toMatchObject({
      email,
    });
  });

  it('trims and lower-cases the email, as the contract says', async () => {
    const fake = createFakeBackend();
    await fake.backend.account.requestCode({ email: ' Anna@Mail.com ', editionId: 'uk' });

    expect(fake.account.sentCodes.at(-1)?.email).toBe('anna@mail.com');
    const code = fake.account.sentCodes.at(-1)?.code ?? '';
    await expect(
      fake.backend.account.verifyCode({ email: 'ANNA@mail.com', code }),
    ).resolves.toMatchObject({ email: 'anna@mail.com' });
    expect(fake.account.accounts).toEqual(['anna@mail.com']);
  });

  it('answers 400 to an email that is no email, as the backend does', async () => {
    const fake = createFakeBackend();

    await expect(
      fake.backend.account.requestCode({ email: 'anna@mail', editionId: 'uk' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      fake.backend.account.verifyCode({ email: 'anna@mail', code: '100001' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
