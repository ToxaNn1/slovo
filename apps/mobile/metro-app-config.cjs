const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { require: tsxRequire } = require('tsx/cjs/api');

const { EDITIONS_DIR } = tsxRequire('@slovo/language-pack/edition', __filename);

/**
 * The app's Metro config: Expo's, through Sentry's, whose serializer writes a
 * debug id into the bundle and its source map so a crash report finds its map
 * (ADR 0048), plus the app's own modules (`slovo-editions`, `slovo-app/*`),
 * each resolved to its file. Kept apart from metro.config.cjs, which builds
 * those modules from the Language Pack, so a test needs no pack.
 */
function appMetroConfig(projectRoot, modules) {
  const config = getSentryExpoConfig(projectRoot);
  config.resolver.assetExts.push('db');
  // The Editions are no workspace package, so Metro would read their files once at start and miss
  // every change to an Edition's switches or strings until a restart.
  config.watchFolders = [...config.watchFolders, EDITIONS_DIR];

  const resolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (Object.hasOwn(modules, moduleName)) {
      return { type: 'sourceFile', filePath: modules[moduleName] };
    }
    return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
  };
  return config;
}

module.exports = { appMetroConfig };
