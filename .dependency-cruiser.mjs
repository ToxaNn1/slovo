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
      name: 'server-core-imports-only-contracts-and-zod',
      comment:
        'ADR 0030: the server Core holds the rules of the backend and reaches HTTP, SQL, ' +
        'better-auth and the Editions through ports it defines, so it imports no workspace ' +
        'part but contracts and no package but Zod (and Vitest in its tests).',
      severity: 'error',
      from: { path: '^packages/server-core/' },
      to: {
        pathNot: [
          '^packages/(server-core|contracts)/',
          SHARED_CONFIG,
          '(^|/)node_modules/(zod|vitest)/',
        ],
      },
    },
    {
      name: 'backend-imports-no-app-core-ui-or-react',
      comment:
        "ADR 0030: the backend is the server Core's shell. The app's Core, the UI and React " +
        'belong to the mobile app; what both sides share lives in contracts.',
      severity: 'error',
      from: { path: '^apps/backend/' },
      // The bare names catch an import of a package the backend doesn't list, which
      // stays unresolved.
      to: {
        path: [
          '^packages/(core|ui)/',
          '^@slovo/(core|ui)(/|$)',
          '(^|/)node_modules/(react|react-dom|react-native)/',
          '^(react|react-dom|react-native)(/|$)',
        ],
      },
    },
    {
      name: 'mobile-imports-no-server-code',
      comment:
        'ADR 0030: the app talks to the backend over HTTP only, through the contract in ' +
        'contracts, so it imports neither the server Core nor the backend.',
      severity: 'error',
      from: { path: '^apps/mobile/' },
      to: { path: ['^(packages/server-core|apps/backend)/', '^@slovo/(server-core|backend)(/|$)'] },
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
      name: 'ui-layers-import-no-domain-folder',
      comment:
        "ADR 0027: the UI's providers/, decor/ and primitives/ sit below its domain " +
        'folders, so a button or a sheet never depends on the Entries, the Game or ' +
        'any other domain it is used in. index.ts counts too, as it re-exports them all. ' +
        'A test is not part of the layer: it renders through index.ts, the public seam.',
      severity: 'error',
      from: { path: '^packages/ui/src/(providers|decor|primitives)/', pathNot: '\\.test\\.tsx?$' },
      to: {
        path: ['^packages/ui/src/[^/]+/', '^packages/ui/src/index\\.ts$'],
        pathNot: '^packages/ui/src/(providers|decor|primitives)/',
      },
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
          '^packages/[^/]+/src/(index|tokens|entries/part-of-speech|pack-reader|edition-folder|api)\\.ts$',
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
        "configuration files, Jest's setup and resolver files, the Expo Router routes and " +
        "the Maestro flows' scripts (found by their place, not by an import) are entry points.",
      severity: 'error',
      from: {
        orphan: true,
        pathNot: [
          '\\.d\\.ts$',
          '(^|/)[^/]+\\.config\\.(js|cjs|mjs|ts)$',
          '(^|/)jest\\.(setup|resolver)\\.(js|cjs)$',
          '^apps/mobile/src/app/',
          '^apps/mobile/maestro/',
        ],
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
