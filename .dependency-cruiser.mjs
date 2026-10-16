// The package boundaries the ADRs set, checked by `pnpm deps` and in CI.
// Every `forbidden` rule names the ADR it comes from. The Core's own ESLint
// bans (React, Expo, Node) stay in packages/core/eslint.config.js and are not
// repeated here.
//
// A rule is only written when `main` satisfies it. The paths below are the
// real folders of the workspace: a `@slovo/*` import resolves to its folder
// under packages/, not to node_modules.

const WORKSPACE_PART = '^(apps|packages|tools|editions)/';
// packages/config holds the shared lint, TypeScript and Prettier settings that
// every part's own config file imports. It is build tooling, not a layer.
const SHARED_CONFIG = '^packages/config/';

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'contracts-import-nothing-internal',
      comment:
        'ADR 0002, 0006: contracts is the shared vocabulary between the Core and the ' +
        'Editions, so it sits below everything and imports no other part of the workspace.',
      severity: 'error',
      from: { path: '^packages/contracts/' },
      to: { path: WORKSPACE_PART, pathNot: ['^packages/contracts/', SHARED_CONFIG] },
    },
    {
      name: 'core-imports-only-contracts',
      comment:
        'ADR 0002, 0006: the Core is a reusable, language-agnostic product that an Edition ' +
        'extends only through its Extension Points. It reaches content, UI and platform ' +
        'through ports it defines, so it imports no workspace part but contracts.',
      severity: 'error',
      from: { path: '^packages/core/' },
      to: { path: WORKSPACE_PART, pathNot: ['^packages/(core|contracts)/', SHARED_CONFIG] },
    },
    {
      name: 'ui-does-not-reach-up-or-sideways',
      comment:
        'ADR 0002, 0017: the UI draws what the Core models (ADR 0017), so it may import ' +
        'core and contracts, but not the Language Pack, an app, a tool or an Edition: ' +
        'the app hands it content.',
      severity: 'error',
      from: { path: '^packages/ui/' },
      to: { path: WORKSPACE_PART, pathNot: ['^packages/(ui|core|contracts)/', SHARED_CONFIG] },
    },
    {
      name: 'packages-do-not-import-apps-tools-or-editions',
      comment:
        'ADR 0002, 0006: an Edition is configuration plus content, and an app is one ' +
        "Edition's shell. A shared package depends on neither, or the Core stops being " +
        'reusable by the next Edition.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^(apps|tools|editions)/' },
    },
    {
      name: 'apps-do-not-import-tools',
      comment:
        'ADR 0002: tools (content sourcing) are dev-only and never shipped, so no app ' +
        'depends on them.',
      severity: 'error',
      from: { path: '^apps/' },
      to: { path: '^tools/' },
    },
    {
      name: 'tools-do-not-import-apps',
      comment: 'ADR 0002: an app is the shipped shell; build and sourcing tools do not use it.',
      severity: 'error',
      from: { path: '^tools/' },
      to: { path: '^apps/' },
    },
    {
      name: 'editions-import-no-code',
      comment:
        'ADR 0006: an Edition is configuration, content and assets. It carries no code ' +
        'that could replace Core files or screens.',
      severity: 'error',
      from: { path: '^editions/' },
      to: { path: '^(apps|packages|tools)/' },
    },
    {
      name: 'workspace-parts-import-through-the-entry-point',
      comment:
        'ADR 0013, 0018: a part reaches another through its package entry points ' +
        '(package.json "exports"), so the Core owns what is public: the user-state schema ' +
        'stays behind its port (ADR 0013) and the shell uses the composition (ADR 0018), ' +
        'not the modules inside it.',
      severity: 'error',
      from: { path: '^(apps|packages|tools)/([^/]+)/' },
      to: {
        path: '^packages/([^/]+)/',
        pathNot: [
          '^packages/$2/',
          SHARED_CONFIG,
          '^packages/[^/]+/package\\.json$',
          '^packages/[^/]+/src/(index|tokens|entries/part-of-speech|pack-reader)\\.ts$',
        ],
      },
    },
    {
      name: 'no-circular',
      comment:
        'ADR 0018: the modules of the Core depend on each other in one direction (the ' +
        'composition on top), and a cycle hides which one decides. Type-only imports ' +
        'count, so a cycle is cut by moving the shared type out.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      comment:
        'A module that imports nothing and is imported by nothing is dead. Tool ' +
        'configuration files and the Expo Router routes (found by their place, not by an ' +
        'import) are entry points.',
      severity: 'error',
      from: {
        orphan: true,
        pathNot: ['\\.d\\.ts$', '(^|/)[^/]+\\.config\\.(js|cjs|mjs|ts)$', '^apps/mobile/src/app/'],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['/node_modules/', '/dist/', '/\\.expo/'] },
    // Count `import type` too: a type-only cycle is still a cycle.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types'],
    },
  },
};
