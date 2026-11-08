// Conventional Commits, checked in CI on the PR title (the squash commit on
// main) and on every commit of the PR. `pnpm commitlint` checks one message.
import { readdirSync } from 'node:fs';

// The folders that hold the workspace packages (pnpm-workspace.yaml), read
// from disk so a new package is a valid scope the day it lands.
const workspaceFolders = ['apps', 'packages', 'tools', 'editions'].flatMap((dir) =>
  readdirSync(new URL(`./${dir}/`, import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name),
);

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'chore', 'test', 'refactor', 'style']],
    // A workspace package by its folder name, `deps` and `deps-dev` for
    // dependency bumps (Dependabot uses both), or `test`.
    'scope-enum': [2, 'always', [...workspaceFolders, 'deps', 'deps-dev', 'test']],
    // Subjects say what changed in a full sentence, and the squash merge adds
    // the ticket and PR numbers, so the header gets more room than 100.
    'header-max-length': [2, 'always', 150],
    // Subjects may start with a glossary term or a name: "feat: Synonym Rows …",
    // "docs: ADR 0052 …".
    'subject-case': [0],
    // Bodies hold prose, lists and links that are not wrapped by hand.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};
