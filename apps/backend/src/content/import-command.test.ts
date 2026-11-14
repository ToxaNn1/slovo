import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readEdition } from '@slovo/language-pack';
import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { ukrainianSeedFolder } from '@slovo/language-pack/test-support';
import { systemClock } from '@slovo/server-core';
import { afterAll, describe, expect, it } from 'vitest';

import { testDatabaseUrl } from '../test-support';

// An Editions folder holding only the UA Edition, written from the seed snapshot.
const editionsDir = mkdtempSync(join(tmpdir(), 'slovo-import-command-'));
ukrainianSeedFolder(editionsDir);
afterAll(() => {
  rmSync(editionsDir, { recursive: true, force: true });
});

const authored = readEdition(join(editionsDir, 'uk'), {
  registryRequired: true,
  today: systemClock.now(),
}).valid;
if (authored === undefined) throw new Error('the UA Edition folder does not read');
const { content } = authored;

/** Runs `pnpm content import` from the repo root, as the owner does. */
function importCommand(
  ...args: readonly string[]
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const env = { ...process.env, DATABASE_URL: testDatabaseUrl(), EDITIONS_DIR: editionsDir };
  const child = spawn('pnpm', ['--silent', 'content', 'import', ...args], {
    cwd: join(EDITIONS_DIR, '..'),
    env,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

describe('pnpm content import', () => {
  it('imports the Edition and prints what it wrote and the content version', async () => {
    const { code, stdout } = await importCommand('--edition', 'uk');

    expect(code).toBe(0);
    expect(stdout).toContain('Imported the content of "uk"');
    expect(stdout).toMatch(new RegExp(`words:\\s+${String(content.words.length)}\\n`));
    expect(stdout).toMatch(new RegExp(`idioms:\\s+${String(content.idioms.length)}\\n`));
    expect(stdout).toMatch(new RegExp(`tips:\\s+${String(content.tips.length)}\\n`));
    expect(stdout).toMatch(new RegExp(`content version:\\s+${String(content.contentVersion)}\\n`));
  }, 60_000);

  it('leaves an imported Edition as it is without --override and imports over it with it', async () => {
    const refused = await importCommand('--edition', 'uk');
    const overridden = await importCommand('--edition', 'uk', '--override');

    expect(refused.code).toBe(0);
    expect(refused.stderr).toContain('already imported: nothing was written');
    expect(refused.stdout).not.toContain('content version');
    expect(overridden.code).toBe(0);
    expect(overridden.stdout).toMatch(
      new RegExp(`content version:\\s+${String(content.contentVersion + 1)}\\n`),
    );
  }, 60_000);
});
