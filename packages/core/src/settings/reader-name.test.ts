import { describe, expect, it } from 'vitest';

import { openComposition, type AnalyticsPort } from '../index';
import { createMemoryContentPort } from '../testing';
import { analyticsInto, fakeClock, seededRandom, testEdition, word } from '../test-support';
import { createMemoryUserStatePort, openUserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';
import { openReaderName, readerNameOf, READER_NAME_AT_MOST } from './reader-name';

async function opened(records = new Map<string, string>()) {
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  return { records, userState, name: await openReaderName({ userState }) };
}

describe('the reader name', () => {
  it('is none until the reader sets one', async () => {
    const { name } = await opened();
    expect(name.state).toBeUndefined();
  });

  it('keeps a typed name trimmed', async () => {
    const { name, userState } = await opened();
    expect(await name.change('  Олена ')).toEqual({ kind: 'name', name: 'Олена' });
    expect(name.state).toBe('Олена');
    expect(await userState.read(userStateRecords.readerName)).toBe('Олена');
  });

  it(`keeps ${String(READER_NAME_AT_MOST)} characters and refuses one more, keeping the old name`, async () => {
    const { name } = await opened();
    await name.change('Олена');
    const longest = 'я'.repeat(READER_NAME_AT_MOST);
    expect(readerNameOf(` ${longest} `)).toEqual({ kind: 'name', name: longest });
    expect(await name.change(`${longest}я`)).toEqual({ kind: 'tooLong' });
    expect(name.state).toBe('Олена');
  });

  it('forgets the name for an empty or blank one', async () => {
    const { name, userState } = await opened();
    await name.change('Олена');
    expect(await name.change('   ')).toEqual({ kind: 'none' });
    expect(name.state).toBeUndefined();
    expect(await userState.read(userStateRecords.readerName)).toBeUndefined();
  });

  it('reads the name the user state keeps and tells each change', async () => {
    const { name } = await opened(new Map([['settings.readerName', '"Тарас"']]));
    expect(name.state).toBe('Тарас');
    const told: (string | undefined)[] = [];
    name.subscribe(() => told.push(name.state));
    await name.change('Тарас');
    await name.change('Остап');
    expect(told).toEqual(['Остап']);
  });
});

// ADR 0136: never sent with Analytics, Community Counters or the Questionnaire counters.
describe('the reader name in the composition', () => {
  it('is kept in its own record alone and in no Analytics event', async () => {
    const records = new Map<string, string>();
    const events: unknown[] = [];
    const port: AnalyticsPort = {
      track: (event, properties) => void events.push([event, properties]),
      stop: () => undefined,
    };
    const app = await openComposition({
      content: createMemoryContentPort({
        categories: [{ id: 'test', displayName: 'Test', description: 'Test.', tone: 'loud' }],
        words: [word('w_one'), word('w_two')],
      }),
      edition: testEdition({ isFeatureEnabled: () => true }),
      userState: await openUserState({ port: createMemoryUserStatePort(records) }),
      clock: fakeClock('2026-11-14T09:00:00+02:00').clock,
      random: seededRandom(7),
      analytics: analyticsInto(port),
    });

    await app.readerName.change('Олена');
    await app.readerName.change('Оленка');
    await app.knowledge.set('w_one', 'known');

    expect(app.readerName.state).toBe('Оленка');
    expect(JSON.stringify(events)).not.toMatch(/Олен/);
    const holding = [...records].filter(([, value]) => value.includes('Олен')).map(([key]) => key);
    expect(holding).toEqual(['settings.readerName']);
  });
});
