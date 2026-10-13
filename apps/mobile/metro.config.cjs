const { existsSync, readFileSync } = require('node:fs');
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

// SLOVO_CORE_TOKENS=1 draws the app with the Core's neutral tokens and Decor
// instead of the Edition's, to check the Core look. Restart Metro with --clear
// after changing it.
const useCoreTokens = process.env.SLOVO_CORE_TOKENS === '1';

const editionModules = {
  'slovo-edition/config': { type: 'sourceFile', file: 'edition.json' },
  'slovo-edition/strings': { type: 'sourceFile', file: 'strings.json' },
  // Optional: an Edition without tokens.json gets the Core's neutral tokens.
  'slovo-edition/tokens': { type: 'sourceFile', file: 'tokens.json', optional: true },
  // Optional: an Edition without Decor gets the Core's neutral Decor.
  'slovo-edition/decor': { type: 'sourceFile', file: 'decor/decor.json', optional: true },
  'slovo-edition/splash': { type: 'sourceFile', file: 'decor/splash.json', optional: true },
  'slovo-edition/language-pack': {
    type: 'assetFiles',
    file: 'dist/language-pack.db',
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
  const { locale } = JSON.parse(readFileSync(join(editionDir, 'edition.json'), 'utf8'));
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
  const filePath = join(editionDir, editionModule.file);
  if (editionModule.optional && (useCoreTokens || !existsSync(filePath))) {
    return { type: 'empty' };
  }
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
