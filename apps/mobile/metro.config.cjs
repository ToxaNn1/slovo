const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { dirname } = require('node:path');

const { getConfig } = require('expo/config');
const { getDefaultConfig } = require('expo/metro-config');
const { require: tsxRequire } = require('tsx/cjs/api');

// The Edition folder module is TypeScript, which tsx loads, as for app.config.ts.
const { APP_CONFIG_FILE, EDITIONS_DIR, REPO_DIR, openAppConfig, openEdition } = tsxRequire(
  '@slovo/language-pack/edition',
  __filename,
);

/**
 * The Editions the app bundles (ADR 0065), as the one module `slovo-editions`
 * the app's Edition registry reads, so the app code never names an Edition.
 * The build bundles the Edition selected by SLOVO_EDITION, its default.
 */
const { exp } = getConfig(__dirname, { skipSDKVersionRequirement: true });
const defaultId = exp.extra.edition.id;
const bundledIds = [defaultId];
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

/** Where the generated modules lie; git ignores node_modules. */
const GENERATED_DIR = `${__dirname}/node_modules/.cache/slovo-editions`;

/** Writes a generated module and gives its path. */
function generated(fileName, source) {
  const filePath = `${GENERATED_DIR}/${fileName}`;
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, source);
  return filePath;
}

const required = (file) => `require(${JSON.stringify(file)})`;

/** An optional file of the Edition, or undefined when it has none or the Core look is on. */
function optional(edition, file) {
  const path = edition.path(file);
  return useCoreTokens || !existsSync(path) ? 'undefined' : required(path);
}

/** A file the Edition must have, else the bundle fails with what to do. */
function mandatory(edition, file, missing = '') {
  const path = edition.path(file);
  if (!existsSync(path)) {
    throw new Error(`Edition "${edition.config.id}" has no ${path}. ${missing}`);
  }
  return required(path);
}

/**
 * The Illustrations of an Edition (ADR 0055): each PNG of its
 * `assets/illustrations/` by file name.
 */
function illustrations(edition) {
  const lines = edition
    .illustrations()
    .map((name) => `      ${JSON.stringify(name)}: ${required(edition.illustration(name))},`);
  return `{\n${lines.join('\n')}\n    }`;
}

/** The files of one bundled Edition, which the app validates at startup. */
function bundledEdition(edition) {
  const id = edition.config.id;
  return `  ${JSON.stringify(id)}: {
    config: ${mandatory(edition, 'config')},
    strings: ${mandatory(edition, 'strings')},
    tokens: ${optional(edition, 'tokens')},
    decor: ${optional(edition, 'decor')},
    illustrations: ${illustrations(edition)},
    languagePack: ${mandatory(edition, 'languagePack', `Run \`pnpm build:pack ${id}\` to build the Language Pack first.`)},
  },`;
}

const editions = bundledIds.map((id) => openEdition(EDITIONS_DIR, id));

const registryModule = () =>
  generated(
    'editions.js',
    `module.exports = {\n  defaultId: ${JSON.stringify(defaultId)},\n  editions: {\n${editions
      .map(bundledEdition)
      .join('\n')}\n  },\n};\n`,
  );

/**
 * The CLDR plural rules of a bundled Edition's language for the
 * `Intl.PluralRules` polyfill, which Hermes needs (see
 * src/shell/intl-polyfill.ts): the data of its locale, or of the locale's
 * language when the polyfill has no data for the locale itself.
 */
function pluralRulesData(edition) {
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

const pluralRulesModule = () =>
  generated(
    'plural-rules.js',
    editions.map((edition) => `${required(pluralRulesData(edition))};\n`).join(''),
  );

/** The generated modules, written once when Metro starts. */
const generatedModules = {
  'slovo-editions': registryModule(),
  'slovo-editions/plural-rules': pluralRulesModule(),
};

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('db');

const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const filePath = appModules[moduleName] ?? generatedModules[moduleName];
  if (filePath !== undefined) return { type: 'sourceFile', filePath };
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
