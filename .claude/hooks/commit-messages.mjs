// Checks commit messages with the repo's commitlint before CI does, in every
// session, local and cloud (git hooks live outside the repo; this one ships
// with it). After `git commit` it lints the new commit and asks for an amend;
// before `git push` it blocks while any commit of the branch since main fails.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8'));
const command = input.tool_name === 'Bash' ? String(input.tool_input?.command ?? '') : '';
const gitCall = (verb) => new RegExp(`\\bgit\\b[^;&|\\n]*\\s${verb}\\b`).test(command);

const run = (bin, args, cwd) => spawnSync(bin, args, { cwd, encoding: 'utf8' });

const root = run('git', ['rev-parse', '--show-toplevel'], input.cwd).stdout?.trim();

/**
 * commitlint's report on one commit's message, with CI's attribution rule:
 * null when it passes, the report when it fails, and a note when commitlint cannot run (no `pnpm install` yet),
 * so a push is never let through unchecked.
 */
const lint = (sha) => {
  const message = run('git', ['log', '-1', '--format=%B', sha], root).stdout ?? '';
  const result = spawnSync('pnpm', ['-s', 'exec', 'commitlint'], {
    cwd: root,
    encoding: 'utf8',
    input: message,
  });
  // CI's attribution rule (commitlint.yml): these words anywhere but in CLAUDE.md.
  const attribution = /Co-Authored|Claude|Generated with/i.test(message.replaceAll('CLAUDE.md', ''))
    ? 'AI attribution: the message names Co-Authored, Claude or Generated with (only CLAUDE.md may appear); reword it.'
    : null;
  if (result.status === 0) return attribution;
  if (result.status === 1)
    return [`${result.stdout}${result.stderr}`.trim(), attribution].filter(Boolean).join('\n');
  return 'commitlint could not run here: run `pnpm install` at the repo root, then retry.';
};

const scopes =
  'Allowed types and scopes: commitlint.config.js (a scope is a workspace folder name, deps, deps-dev or test).';

if (!root) process.exit(0);

if (input.hook_event_name === 'PreToolUse' && gitCall('push')) {
  // The commits no remote has yet, which is what the push sends; works in a
  // shallow cloud clone without origin/main too.
  const unpushed = (
    run('git', ['rev-list', 'HEAD', '--not', '--remotes', '--no-merges'], root).stdout ?? ''
  )
    .split('\n')
    .filter(Boolean);
  const report = unpushed.map(lint).filter(Boolean).join('\n\n') || null;
  if (report) {
    process.stderr.write(
      `Push blocked: a commit message on this branch fails CI's "Commit messages" check.\n${report}\n${scopes}\nReword the commit before pushing (git commit --amend for the last one).\n`,
    );
    process.exit(2);
  }
}

if (input.hook_event_name === 'PostToolUse' && gitCall('commit')) {
  const report = lint('HEAD');
  if (report) {
    process.stdout.write(
      JSON.stringify({
        decision: 'block',
        reason: `The commit just made fails CI's "Commit messages" check.\n${report}\n${scopes}\nFix it now with git commit --amend, before pushing.`,
      }),
    );
  }
}
