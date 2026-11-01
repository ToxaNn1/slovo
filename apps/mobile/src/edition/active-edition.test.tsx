import { afterAll, describe, expect, it } from '@jest/globals';
import { userStateRecords } from '@slovo/core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { nodeDriver, type NodeDriver } from '../user-state/node-sqlite-driver';
import { openSqliteUserState } from '../user-state/user-state-sqlite';
import { storedUserStateOpening, type OpenDatabase } from '../user-state/stored-user-state';
import { chooseActiveEdition, type AppStore } from './active-edition';

/** An app-level store in memory, as the device's keeps it between launches. */
function memoryAppStore(records: Record<string, string> = {}): AppStore {
  const kept = new Map(Object.entries(records));
  return {
    get: (key) => kept.get(key),
    set(key, value) {
      kept.set(key, value);
    },
  };
}

const editions = { editionIds: ['uk', 'pl'], defaultId: 'uk' };

describe('choosing the Edition at launch', () => {
  it('opens the Edition of the device language', () => {
    const choice = { ...editions, deviceLanguages: ['pl'], appStore: memoryAppStore() };

    expect(chooseActiveEdition(choice)).toBe('pl');
  });

  it('takes the first preferred language that has an Edition', () => {
    const choice = { ...editions, deviceLanguages: ['de', 'pl', 'uk'], appStore: memoryAppStore() };

    expect(chooseActiveEdition(choice)).toBe('pl');
  });

  it('opens the UA Edition when no device language has an Edition', () => {
    const choice = { ...editions, deviceLanguages: ['en', 'de'], appStore: memoryAppStore() };

    expect(chooseActiveEdition(choice)).toBe('uk');
  });

  it('opens the UA Edition when the device names no language', () => {
    const choice = { ...editions, deviceLanguages: [], appStore: memoryAppStore() };

    expect(chooseActiveEdition(choice)).toBe('uk');
  });

  it('keeps the Edition it chose when the device language changes', () => {
    const appStore = memoryAppStore();
    chooseActiveEdition({ ...editions, deviceLanguages: ['en'], appStore });

    expect(chooseActiveEdition({ ...editions, deviceLanguages: ['pl'], appStore })).toBe('uk');
  });

  it('chooses again when the kept Edition is no longer in the app', () => {
    const appStore = memoryAppStore({ activeEdition: 'cs' });

    expect(chooseActiveEdition({ ...editions, deviceLanguages: ['pl'], appStore })).toBe('pl');
  });
});

describe('the user state of each Edition', () => {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-editions-'));
  const opened: NodeDriver[] = [];
  /** The databases of the app's documents directory, by name. */
  const openDatabase: OpenDatabase = (name) => {
    const db = nodeDriver(join(dir, name));
    opened.push(db);
    return Promise.resolve(db);
  };
  afterAll(() => {
    for (const db of opened) db.close();
  });

  it('adopts the store of a 0.9 reader as the UA Edition’s, with nothing moved', async () => {
    // What 0.9 left on the phone: one user state, before there were Editions.
    const before = await openSqliteUserState(await openDatabase('user-state.db'));
    await before.write(userStateRecords.noCounters.change(true));

    const userState = await storedUserStateOpening('uk', openDatabase).opened();

    expect(await userState.read(userStateRecords.noCounters)).toBe(true);
  });

  it('keeps another Edition’s user state apart from the UA Edition’s', async () => {
    const uk = await storedUserStateOpening('uk', openDatabase).opened();
    await uk.write(userStateRecords.selfCheck.change(true));

    const pl = await storedUserStateOpening('pl', openDatabase).opened();

    expect(await pl.read(userStateRecords.selfCheck)).toBeUndefined();
    expect(await uk.read(userStateRecords.selfCheck)).toBe(true);
  });
});
