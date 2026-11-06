import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// The content wave launcher lives beside the wave helpers; its dry run is its only check.
const launcher = fileURLToPath(new URL('../../../scripts/content-wave/launch.sh', import.meta.url));

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-wave-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

/** Runs the launcher over a plan written into the temp folder, with an empty PATH for `claude`. */
function launch(plan: string, args: string[] = ['--dry-run']) {
  const planFile = join(workDir, 'plan.txt');
  writeFileSync(planFile, plan);
  const run = spawnSync('bash', [launcher, ...args, planFile], {
    encoding: 'utf8',
    env: { PATH: '/usr/bin:/bin', HOME: workDir, TMPDIR: workDir },
  });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

const samplePlan = `# The 07.11 wave
wave content/1107-wave 90

content/1107-words-a   words     lists/words-a.txt  15
content/1107-idioms    idioms    lists/idioms.txt   10 # one implementer per line
`;

describe('launch.sh --dry-run', () => {
  it('prints each brief filled for its implementer and kind', () => {
    const run = launch(samplePlan);

    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    const words = run.stdout.split('== content/1107-idioms')[0] ?? '';
    const idioms = run.stdout.split('== content/1107-idioms')[1] ?? '';
    expect(words).toContain('== content/1107-words-a: 15 words from lists/words-a.txt');
    expect(words).toContain('git checkout -b content/1107-words-a origin/content/1107-wave');
    expect(words).toContain('Grant: commit and push ONLY content/1107-words-a;');
    expect(words).toContain('pnpm source:words lists/words-a.txt --edition uk');
    expect(words).toContain(
      'pnpm content import word tools/sourcing/review/words/drafts --edition uk --no-record',
    );
    expect(words).toContain('pnpm content verify --changed origin/content/1107-wave --edition uk');
    expect(words).toContain('chore: DONE content/1107-words-a');
    expect(idioms).toContain('pnpm source:idioms lists/idioms.txt --edition uk');
    expect(idioms).toContain(
      'pnpm content import idiom tools/sourcing/review/idioms/drafts --edition uk --no-record',
    );
    expect(idioms).not.toContain('words-a');
  });

  it('keeps every brief within 1.5 KB', () => {
    const run = launch(samplePlan);

    const briefs = run.stdout.split('--- brief\n').slice(1);
    expect(briefs).toHaveLength(2);
    for (const brief of briefs) {
      const text = brief.split('\n--- start')[0] ?? '';
      expect(Buffer.byteLength(text)).toBeLessThanOrEqual(1536);
    }
  });

  it('prints the cloud start and one waiter per implementer and starts nothing', () => {
    const run = launch(samplePlan);

    // The log folder is the temp folder through its symlinks, as macOS's /var is /private/var.
    const logs = join(realpathSync(workDir), 'slovo-wave-content-1107-wave');
    expect(run.stdout).toContain(
      `script -q '${logs}/content-1107-words-a.log' claude --cloud "$(cat '${logs}/content-1107-words-a.brief')" </dev/null >/dev/null`,
    );
    expect(run.stdout).toContain(
      `b='content/1107-words-a'; end=$((SECONDS + 90 * 60)); until git ls-remote --exit-code origin "refs/heads/\${b}" >/dev/null && git fetch -q --no-write-fetch-head origin "+refs/heads/\${b}:refs/wave/\${b}" && s=$(git log -1 --format=%s "refs/wave/\${b}") && printf '%s\\n' "$s" | grep -qE '^chore: (DONE|FAILED|STUCK)'; do if [ "$SECONDS" -ge "$end" ]; then echo "STALE \${b}"; exit 1; fi; sleep 60; done; echo "\${b}: $s"`,
    );
    expect(run.stdout).toContain(`b='content/1107-idioms';`);
    expect(run.stdout).not.toContain('FETCH_HEAD');
    // Nothing is written: no log folder, no brief files.
    expect(readdirSync(workDir)).toEqual(['plan.txt']);
  });

  it('refuses an unknown kind by its line before printing anything', () => {
    const run = launch('wave content/1107-wave 90\ncontent/1107-tips tips lists/tips.txt 5\n');

    expect(run.status).toBe(2);
    expect(run.stdout).toBe('');
    expect(run.stderr).toContain('line 2: unknown kind «tips»');
  });

  it('refuses a plan without its wave line', () => {
    const run = launch('content/1107-words-a words lists/words-a.txt 15\n');

    expect(run.status).toBe(2);
    expect(run.stderr).toContain('line 1: expected «wave <branch> <minutes>» first');
  });

  it('refuses a count that is not a whole number', () => {
    const run = launch('wave content/1107-wave 90\ncontent/1107-words-a words lists/w.txt many\n');

    expect(run.status).toBe(2);
    expect(run.stderr).toContain('line 2: expected «<branch> <kind> <list file> <count>»');
  });
});
