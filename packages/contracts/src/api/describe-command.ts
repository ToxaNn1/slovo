// `pnpm describe:api [promised.json]`: records the description of `/v1` after
// an additive change of the contract (ADR 0031). It compares the contract's
// description with the promised one, the committed file unless another is
// named, as CI names the one on the base branch. A change that breaks it is
// listed and nothing is written; otherwise the committed file becomes the
// description.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMMITTED_DESCRIPTION, describeApi } from '../api-description';
import { breakingChanges } from './breaking-changes';

// pnpm runs a package's script in the package; the path is the caller's.
const named = process.argv[2];
const promisedPath = named ? resolve(process.env['INIT_CWD'] ?? '.', named) : COMMITTED_DESCRIPTION;

const described = await describeApi();
// Only the first run finds no committed description; a named one must be there.
const promised =
  named || existsSync(promisedPath)
    ? (JSON.parse(readFileSync(promisedPath, 'utf8')) as object)
    : undefined;
const changes = promised ? breakingChanges(promised, described) : [];

if (changes.length > 0) {
  console.error(
    `The contract breaks /v1 (ADR 0031); a breaking change takes /v2:\n${changes.map((change) => `- ${change}`).join('\n')}`,
  );
  process.exitCode = 1;
} else {
  writeFileSync(COMMITTED_DESCRIPTION, `${JSON.stringify(described, null, 2)}\n`);
  const where = relative(process.env['INIT_CWD'] ?? '.', fileURLToPath(COMMITTED_DESCRIPTION));
  console.log(`The description of /v1 is recorded in ${where}.`);
}
