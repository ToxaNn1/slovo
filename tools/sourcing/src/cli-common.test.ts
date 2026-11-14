import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { UK_SEED_SNAPSHOT } from '@slovo/language-pack/test-support';

import { prepareRun } from './cli-common';
import { ukSeedSnapshot } from './test-support';

function listFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-list-'));
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  const file = join(dir, 'list.txt');
  writeFileSync(file, 'мжичка\n');
  return file;
}

const input = { edition: 'uk', out: undefined, cache: undefined };

describe('prepareRun', () => {
  it('opens the Edition with the records of the snapshot it is given', async () => {
    const run = await prepareRun({
      ...input,
      listFile: listFile(),
      snapshot: UK_SEED_SNAPSHOT,
      apiUrl: undefined,
    });

    const words = run.ok ? run.options.edition.entries().words.map(({ entry }) => entry.id) : [];
    expect(words).toEqual(ukSeedSnapshot().words.map(({ id }) => id));
  });

  it('fails loudly, never with an empty Edition, when no snapshot is given', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const run = await prepareRun({
      ...input,
      listFile: listFile(),
      snapshot: undefined,
      apiUrl: undefined,
    });

    expect(run).toEqual({ ok: false, exitCode: 2 });
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/--snapshot <file>/));
    error.mockRestore();
  });
});
