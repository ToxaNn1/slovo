const { existsSync } = require('node:fs');

const { getConfig } = require('expo/config');
const { getDefaultConfig } = require('expo/metro-config');
const { require: tsxRequire } = require('tsx/cjs/api');

// The Edition folder module is TypeScript, which tsx loads, as for app.config.ts.
const { EDITIONS_DIR, openEdition } = tsxRequire('@slovo/language-pack/edition', __filename);

/**
 * Bundles the Edition selected by SLOVO_EDITION. The app imports it through
 * `slovo-edition/*`, which resolves into that Edition's folder here, so the
 * app code never names an Edition.
 */
const { exp } = getConfig(__dirname, { skipSDKVersionRequirement: true });
const editionId = exp.extra.edition.id;
const edition = openEdition(EDITIONS_DIR, editionId);

// SLOVO_CORE_TOKENS=1 draws the app with the Core's neutral tokens and Decor
// instead of the Edition's, to check the Core look. Restart Metro with --clear
// after changing it.
const useCoreTokens = process.env.SLOVO_CORE_TOKENS === '1';

const editionModules = {
  'slovo-edition/config': { type: 'sourceFile', editionFile: 'config' },
  'slovo-edition/strings': { type: 'sourceFile', editionFile: 'strings' },
  // Optional: an Edition without tokens gets the Core's neutral tokens.
  'slovo-edition/tokens': { type: 'sourceFile', editionFile: 'tokens', optional: true },
  // Optional: an Edition without Decor gets the Core's neutral Decor.
  'slovo-edition/decor': { type: 'sourceFile', editionFile: 'decor', optional: true },
  'slovo-edition/splash': { type: 'sourceFile', editionFile: 'splash', optional: true },
  'slovo-edition/language-pack': {
    type: 'assetFiles',
    editionFile: 'languagePack',
    missing: `Run \`pnpm build:pack ${editionId}\` to build the Language Pack first.`,
  },
};

/**
 * The CLDR plural rules of the Edition's language for the `Intl.PluralRules`
 * polyfill, which Hermes needs (see src/intl-polyfill.ts): the data of its
 * locale, or of the locale's language when the polyfill has no data for the
 * locale itself.
 */
function pluralRulesData() {
  const { locale } = edition.config;
  for (const tag of [locale, locale.split('-')[0]]) {
    try {
      return require.resolve(`@formatjs/intl-pluralrules/locale-data/${tag}.js`, {
        paths: [__dirname],
      });
    } catch {
      // Try the language next.
    }
  }
  throw new Error(`The Intl.PluralRules polyfill has no plural rules for "${locale}".`);
}

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('db');

const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'slovo-edition/plural-rules') {
    return { type: 'sourceFile', filePath: pluralRulesData() };
  }
  const editionModule = editionModules[moduleName];
  if (editionModule === undefined) {
    return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
  }
  const filePath = edition.path(editionModule.editionFile);
  if (editionModule.optional && (useCoreTokens || !existsSync(filePath))) {
    return { type: 'empty' };
  }
  if (!existsSync(filePath)) {
    throw new Error(`Edition "${editionId}" has no ${filePath}. ${editionModule.missing ?? ''}`);
  }
  return editionModule.type === 'assetFiles'
    ? { type: 'assetFiles', filePaths: [filePath] }
    : { type: 'sourceFile', filePath };
};

module.exports = config;
