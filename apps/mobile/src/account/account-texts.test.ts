import { createMemorySessionStore, openAccount, systemRandom, type Account } from '@slovo/core';
import {
  createFakeAppleSignInSheet,
  createFakeBackend,
  createFakeGoogleSignInSheet,
  seedUserState,
} from '@slovo/core/testing';
import { describe, expect, it } from 'vitest';

import { accountProblemLine, accountSummary } from './account-texts';
import { count, fakeClock, strings } from '../test-support';

async function open() {
  const api = createFakeBackend();
  const account = await openAccount({
    backend: api.backend,
    edition: { id: 'uk', isFeatureEnabled: () => false },
    googleSheet: createFakeGoogleSignInSheet(),
    appleSheet: createFakeAppleSignInSheet(),
    sessions: createMemorySessionStore(),
    userState: await seedUserState(),
    clock: fakeClock().clock,
    schedule: (run) => {
      run();
      return () => undefined;
    },
    random: systemRandom,
  });
  return { account, api };
}

const problemOf = ({ state }: Account) =>
  accountProblemLine({ state, strings: strings.account, count });

describe('the Account row of Settings', () => {
  it('reads «Увійти» while signed out, and the email once signed in', async () => {
    const { account, api } = await open();
    expect(accountSummary(account.state, strings.account)).toBe('Увійти');

    await account.requestCode('anna@mail.com');
    expect(accountSummary(account.state, strings.account)).toBe('Увійти');
    await account.verifyCode(api.account.sentCodes[0]?.code ?? '');

    expect(accountSummary(account.state, strings.account)).toBe('anna@mail.com');
  });

  it('reads nothing while the Account opens', () => {
    expect(accountSummary(undefined, strings.account)).toBeUndefined();
  });
});

describe('the problem line of the Account screen', () => {
  it('has none while nothing went wrong', async () => {
    const { account } = await open();

    expect(problemOf(account)).toBeUndefined();
  });

  it('asks to check an email that is not one', async () => {
    const { account } = await open();

    await account.requestCode('anna@');

    expect(problemOf(account)).toBe('Перевірте адресу пошти.');
  });

  it('counts the tries a wrong code has left, in their plural form', async () => {
    const { account } = await open();
    await account.requestCode('anna@mail.com');

    await account.verifyCode('999999');
    expect(problemOf(account)).toBe('Код не підходить. Лишилось 4 спроби.');
    await account.verifyCode('999998');
    await account.verifyCode('999997');
    await account.verifyCode('999996');

    expect(problemOf(account)).toBe('Код не підходить. Лишилась 1 спроба.');
  });

  it('says a code ran out, and that there is no connection', async () => {
    const { account, api } = await open();
    await account.requestCode('anna@mail.com');

    api.account.expireCodes();
    await account.verifyCode(api.account.sentCodes[0]?.code ?? '');
    expect(problemOf(account)).toBe('Код більше не діє. Надішліть новий.');
    api.failNext('offline', 'offline', 'offline', 'offline');
    await account.verifyCode(api.account.sentCodes[0]?.code ?? '');

    expect(problemOf(account)).toBe('Немає з’єднання з інтернетом. Спробуйте ще раз.');
  });
});
