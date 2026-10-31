const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { dirname, relative } = require('node:path');

const { getConfig } = require('expo/config');
const { getDefaultConfig } = require('expo/metro-config');
const { require: tsxRequire } = require('tsx/cjs/api');

// The Edition folder module is TypeScript, which tsx loads, as for app.config.ts.
const { APP_CONFIG_FILE, EDITIONS_DIR, REPO_DIR, openAppConfig, openEdition } = tsxRequire(
  '@slovo/language-pack/edition',
  __filename,
);

/**
 * Bundles the Edition the app config bundles, the AppConfig's default Edition. The app imports it through
 * `slovo-edition/*`, which resolves into that Edition's folder here, so the
 * app code never names an Edition.
 */
const { exp } = getConfig(__dirname, { skipSDKVersionRequirement: true });
const editionId = exp.extra.edition.id;
const edition = openEdition(EDITIONS_DIR, editionId);
const app = openAppConfig(REPO_DIR);

/** The AppConfig and the native splash it names, as `slovo-app/*` (ADR 0065). */
const appModules = {
  'slovo-app/config': `${REPO_DIR}/${APP_CONFIG_FILE}`,
  'slovo-app/splash': app.path('splash'),
};

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
  'slovo-edition/illustrations': { type: 'sourceFile', editionFile: 'illustrations' },
  'slovo-edition/language-pack': {
    type: 'assetFiles',
    editionFile: 'languagePack',
    missing: `Run \`pnpm build:pack ${editionId}\` to build the Language Pack first.`,
  },
};

/**
 * The Illustrations of the Edition as a module Metro bundles (ADR 0055): each
 * PNG of its `assets/illustrations/` by file name, written next to the
 * Language Pack in the Edition's build output, which git ignores.
 */
function illustrationsModule() {
  const filePath = `${dirname(edition.path('languagePack'))}/illustrations.js`;
  const lines = edition.illustrations().map((name) => {
    const asset = relative(dirname(filePath), edition.illustration(name));
    return `  ${JSON.stringify(name)}: require(${JSON.stringify(`./${asset}`)}),`;
  });
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `module.exports = {\n${lines.join('\n')}\n};\n`);
  return filePath;
}

const editionPaths = { illustrations: illustrationsModule() };

/**
 * The CLDR plural rules of the Edition's language for the `Intl.PluralRules`
 * polyfill, which Hermes needs (see src/shell/intl-polyfill.ts): the data of its
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
  const appModule = appModules[moduleName];
  if (appModule !== undefined) return { type: 'sourceFile', filePath: appModule };
  const editionModule = editionModules[moduleName];
  if (editionModule === undefined) {
    return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
  }
  const filePath =
    editionPaths[editionModule.editionFile] ?? edition.path(editionModule.editionFile);
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
