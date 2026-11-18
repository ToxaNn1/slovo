import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// The ADR index script lives in the root scripts (ADR 0193); this package runs its tests.
const script = fileURLToPath(new URL('../../../scripts/adr-index.mjs', import.meta.url));

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'slovo-adr-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function adr(file: string, summary: string | undefined) {
  const top = summary === undefined ? '' : `---\nsummary: ${summary}\n---\n\n`;
  writeFileSync(join(dir, file), `${top}# A title\n\nBody: not a summary.\n`);
}

function retired(...lines: string[]) {
  writeFileSync(join(dir, 'retired.md'), `# Retired ADR numbers\n\n${lines.join('\n')}\n`);
}

function run(...args: string[]) {
  return runIn(dir, ...args);
}

function runIn(adrDir: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [script, '--dir', adrDir, ...args], {
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('the ADR index', () => {
  it('lists every number in order, from the summaries and the retired numbers', () => {
    adr('0003-third.md', 'The third decision, `with: code`.');
    adr('0001-first.md', 'The first decision.');
    retired('- 0002: merged into 0001.');

    const { status, stdout } = run();

    expect(status).toBe(0);
    expect(stdout.split('\n').filter((line) => line.startsWith('- '))).toEqual([
      '- [0001](0001-first.md) The first decision.',
      '- 0002: merged into 0001.',
      '- [0003](0003-third.md) The third decision, `with: code`.',
    ]);
  });

  it('prints the next free number', () => {
    adr('0001-first.md', 'The first decision.');
    retired('- 0002: unused.');

    expect(run('--next').stdout).toBe('0003\n');
  });

  it('checks quietly when every number is accounted for', () => {
    adr('0001-first.md', 'The first decision.');
    retired();

    expect(run('--check')).toEqual({ status: 0, stdout: '', stderr: '' });
  });

  it('fails on an ADR without a summary, a shared number and a gap', () => {
    adr('0001-first.md', undefined);
    adr('0002-second.md', 'The second decision.');
    adr('0004-fourth.md', 'The fourth decision.');
    retired('- 0002: unused.');

    const { status, stdout, stderr } = run('--check');

    expect(status).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain('0001-first.md: no frontmatter `summary:`');
    expect(stderr).toContain('0002: two entries share the number');
    expect(stderr).toContain('0003: no ADR file and no line in retired.md');
  });

  it('accounts for every number of the repo', () => {
    const { status, stderr } = runIn(
      fileURLToPath(new URL('../../../docs/adr/', import.meta.url)),
      '--check',
    );

    expect(stderr).toBe('');
    expect(status).toBe(0);
  });
});
