// Formats a file with the repo's prettier right after an agent edits it, so
// `prettier --check .` in lint and CI never fails on an agent's edit. Files
// prettier ignores (.prettierignore, unknown types) are left as they are.
// Never blocks: a missing prettier (no `pnpm install` yet) is skipped.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const file = String(input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? '');
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? '';
const prettier = path.join(root, 'node_modules', '.bin', 'prettier');

const inside =
  file &&
  !path.relative(root, file).startsWith('..') &&
  !path.isAbsolute(path.relative(root, file));
if (inside && existsSync(file) && existsSync(prettier)) {
  spawnSync(prettier, ['--write', '--ignore-unknown', '--log-level', 'silent', file], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20_000,
  });
}
