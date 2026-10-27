// Conventional Commits, checked in CI on the PR title (the squash commit on
// main) and on every commit of the PR. `pnpm commitlint` checks one message.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'chore', 'test', 'refactor']],
    // A workspace package by its folder name, or `deps` and `deps-dev`
    // for dependency bumps (Dependabot uses both).
    'scope-enum': [
      2,
      'always',
      [
        'backend',
        'config',
        'content',
        'contracts',
        'core',
        'deps',
        'deps-dev',
        'language-pack',
        'mobile',
        'server-core',
        'sourcing',
        'test',
        'ui',
        'uk',
        'widget',
      ],
    ],
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
