import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { scriptGenerator } from './generator';

// Stands in for recordings/generate.py: answers by the --out-dir protocol,
// failing every request whose text is «зламане».
const STUB = `
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
const requests = JSON.parse(readFileSync(arg('--requests'), 'utf8'));
const out = arg('--out-dir');
mkdirSync(out, { recursive: true });
const results = requests.map((request) => {
  if (request.text === 'зламане') return { id: request.id, ok: false };
  writeFileSync(out + '/' + request.id + '.mp3', request.voice + ':' + request.text);
  return { id: request.id, ok: true, durationMs: 700 };
});
writeFileSync(out + '/results.json', JSON.stringify(results));
`;

describe('the script generator', () => {
  const dir = mkdtempSync(join(tmpdir(), 'generator-'));
  const stub = join(dir, 'stub.cjs');
  writeFileSync(stub, STUB);

  it('answers each request with its Recording, or with a failure, in request order', async () => {
    const generator = scriptGenerator({ command: [process.execPath, stub], modelDir: dir });
    const outcomes = await generator.record([
      { voice: 'oksana', text: 'обру́ч' },
      { voice: 'taras', text: 'зламане' },
    ]);
    expect(outcomes).toEqual([
      { ok: true, bytes: new Uint8Array(Buffer.from('oksana:обру́ч')), durationMs: 700 },
      { ok: false },
    ]);
  });

  it('stops a hung script at its time limit and fails the batch', async () => {
    const hung = join(dir, 'hung.cjs');
    writeFileSync(hung, 'setTimeout(() => {}, 60_000);');
    const generator = scriptGenerator({
      command: [process.execPath, hung],
      modelDir: dir,
      timeoutMs: 200,
    });
    const started = Date.now();
    await expect(generator.record([{ voice: 'oksana', text: 'обру́ч' }])).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it('records nothing for no requests, without running the script', async () => {
    const generator = scriptGenerator({ command: ['/nonexistent'], modelDir: dir });
    expect(await generator.record([])).toEqual([]);
  });
});
