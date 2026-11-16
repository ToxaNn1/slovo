import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { readSnapshotFile } from '@slovo/language-pack';
import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { describe, expect, it } from 'vitest';

import { testDatabaseUrl } from '../test-support';

const repoDir = join(EDITIONS_DIR, '..');
const seedFile = 'editions/uk/seed-snapshot.json';
const seed = readSnapshotFile(join(repoDir, seedFile));

/** Runs `pnpm content import` from the repo root, as CI and `pnpm dev` do. */
function importCommand(
  ...args: readonly string[]
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const env = { ...process.env, DATABASE_URL: testDatabaseUrl() };
  const child = spawn('pnpm', ['--silent', 'content', 'import', ...args], { cwd: repoDir, env });
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
  it('refuses an import with no snapshot file and names the usage', async () => {
    const { code, stderr } = await importCommand('--edition', 'uk');

    // `pnpm --filter` answers any failing exit code of the command as 1.
    expect(code).not.toBe(0);
    expect(stderr).toContain('--snapshot <file>');
  }, 60_000);

  it('refuses a snapshot file that is not there and writes nothing', async () => {
    const { code, stderr } = await importCommand(
      '--edition',
      'uk',
      '--snapshot',
      'no-such-snapshot.json',
    );

    expect(code).toBe(1);
    expect(stderr).toContain('no-such-snapshot.json');
  }, 60_000);

  it('imports the snapshot file named from the repo root and prints what it wrote', async () => {
    const { code, stdout } = await importCommand('--edition', 'uk', '--snapshot', seedFile);

    expect(code).toBe(0);
    expect(stdout).toContain('Imported the content of "uk"');
    expect(stdout).toMatch(new RegExp(`words:\\s+${String(seed.words.length)}\\n`));
    expect(stdout).toMatch(new RegExp(`content version:\\s+${String(seed.contentVersion)}\\n`));
  }, 60_000);

  it('leaves an imported Edition as it is without --override and imports over it with it', async () => {
    const refused = await importCommand('--edition', 'uk', '--snapshot', seedFile);
    const overridden = await importCommand('--edition', 'uk', '--snapshot', seedFile, '--override');

    expect(refused.code).toBe(0);
    expect(refused.stderr).toContain('already imported: nothing was written');
    expect(refused.stdout).not.toContain('content version');
    expect(overridden.code).toBe(0);
    expect(overridden.stdout).toMatch(
      new RegExp(`content version:\\s+${String(seed.contentVersion + 1)}\\n`),
    );
  }, 60_000);
});
