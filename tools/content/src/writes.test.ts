import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createApiClient } from '@slovo/contracts/api';
import { EDITIONS_DIR, openEditionWithSnapshot } from '@slovo/language-pack/edition';
import { ukrainianSnapshot } from '@slovo/language-pack/test-support';

import { BATCH, backend, fakeIo, refused } from './test-support';
import { add, check, edit, flag, retire } from './writes';

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

/** What the backend answers a write of the record. */
const written = (id: string, recordVersion = 1) => ({
  id,
  recordVersion,
  contentVersion: 42,
  batchId: BATCH,
});

function jsonFile(value: unknown): string {
  const file = join(tempDir(), 'input.json');
  writeFileSync(file, JSON.stringify(value));
  return file;
}

describe('add, against the write API', () => {
  it('creates every record in one batch, without the ids drafts carry, and prints each answer', async () => {
    const folder = join(tempDir(), 'drafts');
    mkdirSync(folder);
    writeFileSync(join(folder, 'b.json'), JSON.stringify({ id: 'w_draft2', lemma: 'друге' }));
    writeFileSync(join(folder, 'a.json'), JSON.stringify({ id: 'w_draft1', lemma: 'перше' }));
    writeFileSync(join(folder, 'notes.txt'), 'not a draft');
    let next = 0;
    const { api, calls } = backend({
      openBatch: () => ({ batchId: BATCH }),
      create: () => ({ ...written(`w_new00${String(++next)}`), needsNewRecording: next === 2 }),
    });
    const { io, printed, problems } = fakeIo();

    const code = await add(api, { editionId: 'uk', kind: 'word', path: folder }, io);

    expect(problems).toEqual([]);
    expect(code).toBe(0);
    expect(calls.map(({ procedure }) => procedure)).toEqual(['openBatch', 'create', 'create']);
    expect(calls.slice(1).map(({ input }) => input)).toEqual([
      { editionId: 'uk', kind: 'word', batchId: BATCH, fields: { lemma: 'перше' } },
      { editionId: 'uk', kind: 'word', batchId: BATCH, fields: { lemma: 'друге' } },
    ]);
    expect(printed).toEqual([
      `w_new001 v1 content v42 batch ${BATCH}`,
      `w_new002 v1 content v42 batch ${BATCH} needs new Recording`,
    ]);
  });

  it('prints each refused rule against its array item and goes on with the rest, exiting 1', async () => {
    const file = jsonFile([{ lemma: 'погане' }, { lemma: 'добре' }]);
    const { api } = backend({
      openBatch: () => ({ batchId: BATCH }),
      create: ({ fields }) => {
        if (JSON.stringify(fields).includes('погане')) {
          throw refused('REFUSED', 422, {
            refusals: [
              { rule: 'stress', entryId: 'w_x', field: 'stress', message: 'Not a vowel' },
              { rule: 'unique-lemma', message: 'Authored twice' },
            ],
          });
        }
        return written('w_good01');
      },
    });
    const { io, printed, problems } = fakeIo();

    const code = await add(api, { editionId: 'uk', kind: 'word', path: file }, io);

    expect(code).toBe(1);
    expect(problems).toEqual([
      `${file}[0]: REFUSED stress (w_x stress): Not a vowel`,
      `${file}[0]: REFUSED unique-lemma: Authored twice`,
    ]);
    expect(printed).toEqual([`w_good01 v1 content v42 batch ${BATCH}`]);
  });

  it('sends nothing when the batch is refused, and says why', async () => {
    const file = jsonFile([{ lemma: 'слово' }]);
    const { api, calls } = backend({
      openBatch: () => {
        throw refused('UNAUTHORIZED', 401);
      },
    });
    const { io, problems } = fakeIo();

    const code = await add(api, { editionId: 'uk', kind: 'word', path: file }, io);

    expect(code).toBe(1);
    expect(calls.map(({ procedure }) => procedure)).toEqual(['openBatch']);
    expect(problems).toEqual([expect.stringMatching(/^batch: UNAUTHORIZED: /)]);
  });

  it.each([
    ['invalid JSON', '[{', /Unreadable or invalid JSON/],
    ['an object, not an array', '{"lemma":"слово"}', /Not a JSON array of records/],
    ['an item that is no object', '[{"lemma":"слово"}, 3]', /\[1\]: Not a JSON object/],
  ])('refuses a file of %s, sending nothing', async (_name, text, problem) => {
    const file = join(tempDir(), 'input.json');
    writeFileSync(file, text);
    const { api, calls } = backend({});
    const { io, problems } = fakeIo();

    const code = await add(api, { editionId: 'uk', kind: 'word', path: file }, io);

    expect(code).toBe(1);
    expect(calls).toEqual([]);
    expect(problems.join('\n')).toMatch(problem);
  });

  it('refuses a draft of a folder that is no JSON object, naming its file', async () => {
    const folder = join(tempDir(), 'drafts');
    mkdirSync(folder);
    writeFileSync(join(folder, 'a.json'), '["слово"]');
    const { api, calls } = backend({});
    const { io, problems } = fakeIo();

    const code = await add(api, { editionId: 'uk', kind: 'word', path: folder }, io);

    expect(code).toBe(1);
    expect(calls).toEqual([]);
    expect(problems).toEqual([`${join(folder, 'a.json')}: Not a JSON object`]);
  });
});

describe('edit, against the write API', () => {
  it('writes from the record version the file names, without the id it carries', async () => {
    const file = jsonFile({ id: 'w_abc123', recordVersion: 3, lemma: 'слово' });
    const { api, calls } = backend({
      openBatch: () => ({ batchId: BATCH }),
      edit: () => written('w_abc123', 4),
    });
    const { io, printed } = fakeIo();

    const code = await edit(api, { editionId: 'uk', kind: 'word', id: 'w_abc123', file }, io);

    expect(code).toBe(0);
    expect(calls.map(({ procedure }) => procedure)).toEqual(['openBatch', 'edit']);
    expect(calls[1]?.input).toEqual({
      editionId: 'uk',
      kind: 'word',
      id: 'w_abc123',
      batchId: BATCH,
      recordVersion: 3,
      fields: { lemma: 'слово' },
    });
    expect(printed).toEqual([`w_abc123 v4 content v42 batch ${BATCH}`]);
  });

  it('without a named version, writes from the one the API holds now', async () => {
    const file = jsonFile({ lemma: 'слово' });
    const { api, calls } = backend({
      record: () => ({ fields: {}, recordVersion: 7, retired: false }),
      openBatch: () => ({ batchId: BATCH }),
      edit: () => written('w_abc123', 8),
    });
    const { io } = fakeIo();

    const code = await edit(api, { editionId: 'uk', kind: 'word', id: 'w_abc123', file }, io);

    expect(code).toBe(0);
    expect(calls.map(({ procedure }) => procedure)).toEqual(['record', 'openBatch', 'edit']);
    expect(calls[2]?.input['recordVersion']).toBe(7);
  });

  it('prints the current version of a STALE write and exits 1', async () => {
    const file = jsonFile({ recordVersion: 2, lemma: 'слово' });
    const { api } = backend({
      openBatch: () => ({ batchId: BATCH }),
      edit: () => {
        throw refused('STALE', 409, { currentVersion: 5 });
      },
    });
    const { io, problems } = fakeIo();

    const code = await edit(api, { editionId: 'uk', kind: 'word', id: 'w_abc123', file }, io);

    expect(code).toBe(1);
    expect(problems).toEqual(['w_abc123: STALE, the current record version is 5']);
  });

  it('opens no batch for a record the API does not have', async () => {
    const file = jsonFile({ lemma: 'слово' });
    const { api, calls } = backend({
      record: () => {
        throw refused('NOT_FOUND', 404);
      },
    });
    const { io, problems } = fakeIo();

    const code = await edit(api, { editionId: 'uk', kind: 'word', id: 'w_none00', file }, io);

    expect(code).toBe(1);
    expect(calls.map(({ procedure }) => procedure)).toEqual(['record']);
    expect(problems).toEqual([expect.stringMatching(/^w_none00: NOT_FOUND: /)]);
  });

  it.each([
    ['an array', '[]', /Not a JSON object/],
    ['invalid JSON', '{', /Unreadable or invalid JSON/],
  ])('refuses a file of %s, sending nothing', async (_name, text, problem) => {
    const file = join(tempDir(), 'record.json');
    writeFileSync(file, text);
    const { api, calls } = backend({});
    const { io, problems } = fakeIo();

    const code = await edit(api, { editionId: 'uk', kind: 'word', id: 'w_abc123', file }, io);

    expect(code).toBe(1);
    expect(calls).toEqual([]);
    expect(problems.join('\n')).toMatch(problem);
  });
});

describe('retire', () => {
  it('retires the record at its current version in a batch of its own', async () => {
    const { api, calls } = backend({
      record: () => ({ fields: {}, recordVersion: 2, retired: false }),
      openBatch: () => ({ batchId: BATCH }),
      retire: () => written('i_abc123', 3),
    });
    const { io, printed } = fakeIo();

    const code = await retire(api, { editionId: 'uk', kind: 'idiom', id: 'i_abc123' }, io);

    expect(code).toBe(0);
    expect(calls.map(({ procedure }) => procedure)).toEqual(['record', 'openBatch', 'retire']);
    expect(calls[2]?.input).toEqual({
      editionId: 'uk',
      kind: 'idiom',
      id: 'i_abc123',
      batchId: BATCH,
      recordVersion: 2,
    });
    expect(printed).toEqual([`i_abc123 v3 content v42 batch ${BATCH}`]);
  });

  it('names the Word that replaces a Retired Word', async () => {
    const { api, calls } = backend({
      record: () => ({ fields: {}, recordVersion: 2, retired: false }),
      openBatch: () => ({ batchId: BATCH }),
      retire: () => written('w_abc123', 3),
    });
    const { io, printed } = fakeIo();

    const code = await retire(
      api,
      { editionId: 'uk', kind: 'word', id: 'w_abc123', replacedBy: 'w_def456' },
      io,
    );

    expect(code).toBe(0);
    expect(calls[2]?.input).toEqual({
      editionId: 'uk',
      kind: 'word',
      id: 'w_abc123',
      batchId: BATCH,
      recordVersion: 2,
      replacedBy: 'w_def456',
    });
    expect(printed).toEqual([`w_abc123 v3 content v42 batch ${BATCH}`]);
  });

  it('exits 1 with the reason when the retire is refused', async () => {
    const { api } = backend({
      record: () => ({ fields: {}, recordVersion: 2, retired: false }),
      openBatch: () => ({ batchId: BATCH }),
      retire: () => {
        throw refused('FORBIDDEN', 403);
      },
    });
    const { io, printed, problems } = fakeIo();

    const code = await retire(api, { editionId: 'uk', kind: 'idiom', id: 'i_abc123' }, io);

    expect(code).toBe(1);
    expect(printed).toEqual([]);
    expect(problems).toEqual([expect.stringMatching(/^i_abc123: FORBIDDEN: /)]);
  });

  it('opens no batch when the current version cannot be read', async () => {
    const { api, calls } = backend({
      record: () => {
        throw refused('NOT_FOUND', 404);
      },
    });
    const { io } = fakeIo();

    const code = await retire(api, { editionId: 'uk', kind: 'idiom', id: 'i_abc123' }, io);

    expect(code).toBe(1);
    expect(calls.map(({ procedure }) => procedure)).toEqual(['record']);
  });
});

describe('flag', () => {
  it('flags the record with its reason and prints the batch', async () => {
    const { api, calls } = backend({
      openBatch: () => ({ batchId: BATCH }),
      flag: ({ id }) => ({ id, batchId: BATCH }),
    });
    const { io, printed } = fakeIo();

    const code = await flag(
      api,
      { editionId: 'uk', kind: 'word', id: 'w_abc123', reason: 'Хибний наголос' },
      io,
    );

    expect(code).toBe(0);
    expect(calls[1]?.input).toEqual({
      editionId: 'uk',
      kind: 'word',
      id: 'w_abc123',
      batchId: BATCH,
      reason: 'Хибний наголос',
    });
    expect(printed).toEqual([`w_abc123 flagged batch ${BATCH}`]);
  });

  it('exits 1 when the batch or the flag is refused', async () => {
    const noBatch = backend({
      openBatch: () => {
        throw refused('UNAUTHORIZED', 401);
      },
    });
    const noFlag = backend({
      openBatch: () => ({ batchId: BATCH }),
      flag: () => {
        throw refused('NOT_FOUND', 404);
      },
    });

    const args = { editionId: 'uk', kind: 'word', id: 'w_abc123', reason: 'Чому' } as const;
    expect(await flag(noBatch.api, args, fakeIo().io)).toBe(1);
    expect(noBatch.calls.map(({ procedure }) => procedure)).toEqual(['openBatch']);
    expect(await flag(noFlag.api, args, fakeIo().io)).toBe(1);
  });
});

describe('check', () => {
  const snapshot = ukrainianSnapshot();
  const { config } = openEditionWithSnapshot(EDITIONS_DIR, 'uk', snapshot);
  const today = new Date('2026-11-16T12:00:00Z');
  const seedWord = snapshot.words.find(({ lemma }) => lemma === 'обруч');
  if (seedWord === undefined) throw new Error('The seed snapshot has no обруч');
  const { id: _seedId, ...seedFields } = seedWord;

  it('passes records that keep the content rules against the current content, sending no write', async () => {
    const file = jsonFile([{ ...seedFields, lemma: 'обручик' }]);
    const { api, calls } = backend({}, { content: { snapshot: () => snapshot } });
    const { io, printed, problems } = fakeIo();

    const code = await check(api, { editionId: 'uk', kind: 'word', path: file, config, today }, io);

    expect(problems).toEqual([]);
    expect(code).toBe(0);
    expect(printed).toEqual(['1 records pass the content rules']);
    expect(calls.map(({ procedure }) => procedure)).toEqual(['/v1/editions/uk/content/snapshot']);
  });

  it('refuses a record that breaks a rule against the current content, or the record schema', async () => {
    const file = jsonFile([seedFields, { ...seedFields, lemma: 'обручик' }, {}]);
    const { api } = backend({}, { content: { snapshot: () => snapshot } });
    const { io, printed, problems } = fakeIo();

    const code = await check(api, { editionId: 'uk', kind: 'word', path: file, config, today }, io);

    expect(code).toBe(1);
    expect(printed).toEqual([]);
    expect(problems.filter((line) => line.startsWith(`${file}[0]:`))).toEqual([
      expect.stringContaining(`REFUSED unique-lemma (primaryDefinition): `),
    ]);
    expect(problems.some((line) => line.startsWith(`${file}[1]:`))).toBe(false);
    expect(problems.filter((line) => line.startsWith(`${file}[2]:`))).toContainEqual(
      expect.stringContaining('REFUSED schema (lemma)'),
    );
  });

  it('exits 1 when the API has no snapshot of the Edition', async () => {
    const file = jsonFile([seedFields]);
    const { api } = backend({});
    const { io, problems } = fakeIo();

    const code = await check(api, { editionId: 'uk', kind: 'word', path: file, config, today }, io);

    expect(code).toBe(1);
    expect(problems).toEqual(['snapshot: INTERNAL_SERVER_ERROR: Internal Server Error']);
  });

  it('refuses unreadable input before asking for the snapshot', async () => {
    const file = join(tempDir(), 'input.json');
    writeFileSync(file, 'nope');
    const { api, calls } = backend({});
    const { io } = fakeIo();

    expect(await check(api, { editionId: 'uk', kind: 'word', path: file, config, today }, io)).toBe(
      1,
    );
    expect(calls).toEqual([]);
  });
});
