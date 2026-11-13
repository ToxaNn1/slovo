import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createApiClient } from '@slovo/contracts/api';

import { add, edit, type Io } from './writes';

/** A client whose backend answers every request with a 500, keeping what was asked. */
function fakeApi() {
  const requests: string[] = [];
  const api = createApiClient({
    url: 'http://backend.test',
    fetch: (request) => {
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      return Promise.resolve(new Response('{}', { status: 500 }));
    },
  });
  return { api, requests };
}

function fakeIo() {
  const printed: string[] = [];
  const problems: string[] = [];
  const io: Io = {
    print: (line) => printed.push(line),
    problem: (line) => problems.push(line),
  };
  return { io, printed, problems };
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'slovo-content-writes-'));
}

describe('add', () => {
  it.each([
    [
      'an empty array file',
      () => {
        const file = join(tempDir(), 'records.json');
        writeFileSync(file, '[]');
        return file;
      },
    ],
    [
      'an empty drafts folder',
      () => {
        const folder = join(tempDir(), 'drafts');
        mkdirSync(folder);
        return folder;
      },
    ],
  ])('refuses %s with exit 1, before opening a batch', async (_name, input) => {
    const { api, requests } = fakeApi();
    const { io, problems } = fakeIo();

    const code = await add(api, { editionId: 'uk', kind: 'word', path: input() }, io);

    expect(code).toBe(1);
    expect(requests).toEqual([]);
    expect(problems.join('\n')).toMatch(/no records/);
  });
});

describe('edit', () => {
  it('refuses a recordVersion that is not a whole number with exit 1, sending nothing', async () => {
    const file = join(tempDir(), 'record.json');
    writeFileSync(file, JSON.stringify({ recordVersion: '3', text: 'слово' }));
    const { api, requests } = fakeApi();
    const { io, problems } = fakeIo();

    const code = await edit(api, { editionId: 'uk', kind: 'word', id: 'w_abc123', file }, io);

    expect(code).toBe(1);
    expect(requests).toEqual([]);
    expect(problems.join('\n')).toMatch(/recordVersion/);
  });
});
