// Blocks agent edits of files that must never be hand-edited:
// - `.env` files hold keys (only `.env.example` is edited by hand);
// - `pnpm-lock.yaml` is written by pnpm alone;
// - a backend migration that already exists has run on some database:
//   a change goes into a new migration from `pnpm db:generate`.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const input = JSON.parse(readFileSync(0, 'utf8'));
const file = String(input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? '');
const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? '';
const relative = path.relative(root, file).split(path.sep).join('/');
const name = path.basename(file);

const reason = (() => {
  if (/^\.env(\..+)?$/.test(name) && name !== '.env.example')
    return `${relative} holds keys and is never edited by an agent; tell the owner what to change.`;
  if (name === 'pnpm-lock.yaml')
    return 'pnpm-lock.yaml is written by pnpm only: run `pnpm install` or `pnpm add`.';
  if (/^apps\/backend\/migrations\/[^/]+\.sql$/.test(relative) && existsSync(file))
    return `${relative} is an existing migration and may have run already: change the schema and run \`pnpm --filter @slovo/backend db:generate\` for a new migration.`;
  return null;
})();

if (reason) {
  process.stderr.write(`Blocked: ${reason}\n`);
  process.exit(2);
}
