import { describe, expect, it, vi } from 'vitest';

import { shareTextFile, type ShareFilePorts } from './share-file';

/** Ports that write, share and delete a cache file, recording each call in order. */
function fakePorts(overrides: Partial<ShareFilePorts> = {}) {
  const calls: string[] = [];
  const ports = {
    writeToCache: vi.fn((name: string) => {
      calls.push(`write ${name}`);
      return Promise.resolve(`file:///caches/${name}`);
    }),
    openShareSheet: vi.fn((url: string) => {
      calls.push(`share ${url}`);
      return Promise.resolve<'shared' | 'cancelled'>('shared');
    }),
    deleteFromCache: vi.fn((url: string) => {
      calls.push(`delete ${url}`);
    }),
    ...overrides,
  } satisfies ShareFilePorts;
  return { ports, calls };
}

const file = { name: 'slovo-uk-data.json', text: '{}', title: 'Мої дані' };

describe('sharing a text file', () => {
  it('writes the file, shares it and deletes it once the share sheet closes', async () => {
    const { ports, calls } = fakePorts();

    expect(await shareTextFile(ports, file)).toBe('shared');
    expect(ports.writeToCache).toHaveBeenCalledWith('slovo-uk-data.json', '{}');
    expect(ports.openShareSheet).toHaveBeenCalledWith(
      'file:///caches/slovo-uk-data.json',
      'Мої дані',
    );
    expect(calls).toEqual([
      'write slovo-uk-data.json',
      'share file:///caches/slovo-uk-data.json',
      'delete file:///caches/slovo-uk-data.json',
    ]);
  });

  it('deletes the file when the reader cancels the share sheet', async () => {
    const { ports } = fakePorts({
      openShareSheet: vi.fn(() => Promise.resolve<'shared' | 'cancelled'>('cancelled')),
    });

    expect(await shareTextFile(ports, file)).toBe('cancelled');
    expect(ports.deleteFromCache).toHaveBeenCalledWith('file:///caches/slovo-uk-data.json');
  });

  it('deletes the file when the share sheet fails, and passes the failure on', async () => {
    const { ports } = fakePorts({
      openShareSheet: vi.fn(() => Promise.reject(new Error('no sheet'))),
    });

    await expect(shareTextFile(ports, file)).rejects.toThrow('no sheet');
    expect(ports.deleteFromCache).toHaveBeenCalledWith('file:///caches/slovo-uk-data.json');
  });
});
