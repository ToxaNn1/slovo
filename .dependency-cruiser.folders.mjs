// The direction between the domain folders of the Core, the UI and the app,
// checked by `pnpm deps` after the boundaries of .dependency-cruiser.mjs.
//
// A separate run, since it leaves out the tests: a test may set its scene up
// with another domain's module, and that says nothing about where the module
// under test belongs.

import boundaries from './.dependency-cruiser.mjs';

const DOMAIN_FOLDER = '^(packages/(core|ui)|apps/mobile)/src/[^/]+$';

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'domain-folders-import-one-way',
      comment:
        'ADR 0027, 0053: the domain folders of a package import each other in one ' +
        'direction, so a cycle between two folders means a module sits in the wrong one.',
      severity: 'error',
      scope: 'folder',
      from: { path: DOMAIN_FOLDER },
      to: { path: DOMAIN_FOLDER, circular: true },
    },
  ],
  options: {
    ...boundaries.options,
    exclude: {
      path: [...boundaries.options.exclude.path, '\\.test\\.tsx?$', '(^|/)test-support\\.ts$'],
    },
  },
};
