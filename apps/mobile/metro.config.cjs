const { existsSync } = require('node:fs');
const { join } = require('node:path');

const { getConfig } = require('expo/config');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Bundles the Edition selected by SLOVO_EDITION. The app imports it through
 * `slovo-edition/*`, which resolves into that Edition's folder here, so the
 * app code never names an Edition.
 */
const { exp } = getConfig(__dirname, { skipSDKVersionRequirement: true });
const editionId = exp.extra.edition.id;
const editionDir = join(__dirname, '../../editions', editionId);

const editionModules = {
  'slovo-edition/config': { type: 'sourceFile', file: 'edition.json' },
  'slovo-edition/strings': { type: 'sourceFile', file: 'strings.json' },
  'slovo-edition/language-pack': {
    type: 'assetFiles',
    file: 'dist/language-pack.db',
    missing: `Run \`pnpm build:pack ${editionId}\` to build the Language Pack first.`,
  },
};

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('db');

const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const editionModule = editionModules[moduleName];
  if (editionModule === undefined) {
    return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
  }
  const filePath = join(editionDir, editionModule.file);
  if (!existsSync(filePath)) {
    throw new Error(
      `Edition "${editionId}" has no ${editionModule.file}. ${editionModule.missing ?? ''}`,
    );
  }
  return editionModule.type === 'assetFiles'
    ? { type: 'assetFiles', filePaths: [filePath] }
    : { type: 'sourceFile', filePath };
};

module.exports = config;
