import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import type * as Contracts from '@slovo/contracts';
import type * as UiTokens from '@slovo/ui/tokens';
import type * as Core from '@slovo/core';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import type * as ConfigPlugins from 'expo/config-plugins';
import { require as tsxRequire } from 'tsx/cjs/api';

import type * as NotificationSound from './notification-sound';
import type * as WidgetExtension from './widget-extension';

type EditionConfig = Contracts.EditionConfig;

/** What the config needs from a contract schema. */
interface Schema<T> {
  safeParse(
    data: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
}

/** The options of the `expo-splash-screen` config plugin that the config sets. */
interface SplashPluginOptions {
  image?: string;
  backgroundColor: string;
  imageWidth?: number;
  dark: { image?: string; backgroundColor: string };
}

// Expo evaluates this file with plain Node, which cannot load the TypeScript
// sources of the workspace packages (their relative imports have no file
// extension). tsx loads them, so the config is checked by the same schema as
// the Language Pack build and the app.
const {
  EditionConfigSchema,
  editionAppGroup,
  EditionStringsSchema,
  EditionTokensSchema,
  SplashDecorSchema,
  WidgetSnapshotSchema,
} = tsxRequire('@slovo/contracts', import.meta.url) as typeof Contracts;
const { loadDecor } = tsxRequire('@slovo/core', import.meta.url) as typeof Core;
const { withDangerousMod } = tsxRequire(
  'expo/config-plugins',
  import.meta.url,
) as typeof ConfigPlugins;
const { readNotificationSound } = tsxRequire(
  './notification-sound.ts',
  import.meta.url,
) as typeof NotificationSound;
const { coreTokens, designTokens } = tsxRequire(
  '@slovo/ui/tokens',
  import.meta.url,
) as typeof UiTokens;
const { writeWidgetExtension } = tsxRequire(
  './widget-extension.ts',
  import.meta.url,
) as typeof WidgetExtension;

/**
 * The one mobile shell builds whichever Edition the SLOVO_EDITION environment
 * variable selects. Everything Edition-specific in the native app comes from
 * the Edition folder; a missing or unknown Edition stops the build.
 */
const EDITION_VARIABLE = 'SLOVO_EDITION';

function knownEditions(editionsDir: string): string[] {
  return readdirSync(editionsDir, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && existsSync(join(editionsDir, entry.name, 'edition.json')),
    )
    .map((entry) => entry.name)
    .sort();
}

/** A JSON file checked against a contract, with every problem named by its field. */
function readJson<T>(file: string, schema: Schema<T>, what: string): T {
  const result = schema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!result.success) {
    const problems = result.error.issues.map(
      ({ path, message }) => `  ${path.length === 0 ? '(file)' : path.join('.')}: ${message}`,
    );
    throw new Error(`${file} is not a valid ${what}:\n${problems.join('\n')}`);
  }
  return result.data;
}

function readEditionConfig(editionDir: string, id: string): EditionConfig {
  const file = join(editionDir, 'edition.json');
  const config = readJson(file, EditionConfigSchema, 'Edition config');
  // Metro and the Language Pack look the Edition up by this id.
  if (config.id !== id) {
    throw new Error(`${file} has id "${config.id}" but lives in the folder "${id}"`);
  }
  return config;
}

/** Every font file the Edition brings in `assets/fonts/`, embedded in the native app. */
function editionFonts(editionDir: string, projectRoot: string): string[] {
  const fontsDir = join(editionDir, 'assets/fonts');
  if (!existsSync(fontsDir)) return [];
  return readdirSync(fontsDir)
    .filter((file) => /\.(otf|ttf)$/.test(file))
    .sort()
    .map((file) => relative(projectRoot, join(fontsDir, file)));
}

/**
 * The Core shows nothing in Decor slot 7: its splash is a plain screen in the
 * Core's neutral background colours (docs/design/design-system.md).
 */
const CORE_SPLASH: SplashPluginOptions = {
  backgroundColor: coreTokens.colors.light.background,
  dark: { backgroundColor: coreTokens.colors.dark.background },
};

/** The splash from the Edition's Decor (`decor/splash.json`), or the Core's plain one. */
function editionSplash(editionDir: string, projectRoot: string): SplashPluginOptions {
  const decorDir = join(editionDir, 'decor');
  const file = join(decorDir, 'splash.json');
  if (!existsSync(file)) return CORE_SPLASH;
  const { imageWidth, light, dark } = readJson(file, SplashDecorSchema, 'splash Decor');
  const image = (name: string) => {
    const path = join(decorDir, name);
    if (!existsSync(path))
      throw new Error(`${file} names a missing splash image: expected ${path}`);
    return relative(projectRoot, path);
  };
  return {
    image: image(light.image),
    backgroundColor: light.backgroundColor,
    imageWidth,
    dark: { image: image(dark.image), backgroundColor: dark.backgroundColor },
  };
}

/**
 * The Edition's notification sound, which the expo-notifications plugin bundles
 * so a local notification can name it. The file is checked here, at build time,
 * because iOS falls back to the default sound without a word when the format is
 * wrong or the sound is too long. Without a sound, notifications use the system
 * default.
 */
function editionNotificationSounds(
  editionDir: string,
  projectRoot: string,
  { notificationSound }: EditionConfig,
): string[] {
  if (notificationSound === undefined) return [];
  const file = join(editionDir, 'assets', notificationSound);
  if (!existsSync(file)) {
    throw new Error(
      `${join(editionDir, 'edition.json')} names no notification sound that exists: expected ${file}`,
    );
  }
  let format: string;
  try {
    ({ format } = readNotificationSound(readFileSync(file)));
  } catch (error) {
    throw new Error(
      `${file} is not a valid notification sound: ${error instanceof Error ? error.message : String(error)}`,
      {
        cause: error,
      },
    );
  }
  if (!notificationSound.endsWith(`.${format}`)) {
    throw new Error(
      `${file} is a ${format.toUpperCase()} file but its name says otherwise; rename it to .${format}`,
    );
  }
  return [relative(projectRoot, file)];
}

/** An optional Edition file as JSON, or `{}` when the Edition leaves it out. */
const readOptionalJson = (file: string): unknown =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};

/**
 * What the widget extension takes from the Edition, checked here so a broken
 * Edition stops the config rather than the native build. The files
 * themselves are made at prebuild (`widget-extension.ts`).
 */
function widgetEdition(
  editionDir: string,
  projectRoot: string,
  config: EditionConfig,
  scheme: string,
): WidgetExtension.WidgetEdition {
  const exampleSnapshot = join(editionDir, 'widget-snapshot.example.json');
  if (!existsSync(exampleSnapshot)) {
    throw new Error(
      `Edition "${config.id}" has no example Widget Snapshot for the widget gallery: expected ${exampleSnapshot}`,
    );
  }
  readJson(exampleSnapshot, WidgetSnapshotSchema, 'Widget Snapshot');
  const tokens = EditionTokensSchema.parse(readOptionalJson(join(editionDir, 'tokens.json')));
  return {
    config,
    scheme,
    strings: readJson(join(editionDir, 'strings.json'), EditionStringsSchema, 'Edition strings')
      .widget,
    tokens: designTokens(tokens),
    band: loadDecor(readOptionalJson(join(editionDir, 'decor/decor.json'))).divider.band,
    fontFiles: editionFonts(editionDir, projectRoot).map((font) => join(projectRoot, font)),
    exampleSnapshot,
  };
}

/**
 * Writes the widget extension's Edition files into `apps/widget` at
 * prebuild, before the Apple targets plugin links the folder into the Xcode
 * project as the extension's target.
 */
function withWidgetExtension(
  config: ExpoConfig,
  widgetDir: string,
  edition: WidgetExtension.WidgetEdition,
): ExpoConfig {
  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      writeWidgetExtension(widgetDir, edition);
      return Promise.resolve(modConfig);
    },
  ]);
}

function selectEdition(editionsDir: string): { dir: string; config: EditionConfig } {
  const known = knownEditions(editionsDir);
  const hint = `Known Editions: ${known.join(', ')}. Example: ${EDITION_VARIABLE}=${known[0] ?? '<edition>'} pnpm start`;
  // Expo types every environment variable as `any`; narrow it here.
  const value: unknown = process.env[EDITION_VARIABLE];
  const id = typeof value === 'string' ? value : undefined;
  if (id === undefined || id === '') {
    throw new Error(`${EDITION_VARIABLE} is not set, so there is no Edition to build.\n${hint}`);
  }
  if (!known.includes(id)) {
    throw new Error(`Unknown Edition "${id}" in ${EDITION_VARIABLE}.\n${hint}`);
  }
  const dir = join(editionsDir, id);
  return { dir, config: readEditionConfig(dir, id) };
}

export default ({ config, projectRoot }: ConfigContext): ExpoConfig => {
  const edition = selectEdition(join(projectRoot, '../../editions'));
  const [language] = edition.config.locale.split('-');
  const icon = join(edition.dir, 'assets/icon.png');
  if (!existsSync(icon)) {
    throw new Error(`Edition "${edition.config.id}" has no icon: expected ${icon}`);
  }

  const scheme = `slovo-${edition.config.id}`;
  const widget = widgetEdition(edition.dir, projectRoot, edition.config, scheme);

  const expoConfig: ExpoConfig = {
    ...config,
    name: edition.config.displayName,
    slug: 'slovo',
    owner: 'anton_de',
    version: '0.1.0',
    scheme,
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: relative(projectRoot, icon),
    ios: {
      bundleIdentifier: edition.config.bundleId,
      supportsTablet: false,
      infoPlist: {
        CFBundleDevelopmentRegion: language,
        CFBundleLocalizations: [language],
        ITSAppUsesNonExemptEncryption: false,
      },
      // The widget extension gets the same App Group from the Apple targets plugin.
      entitlements: {
        'com.apple.security.application-groups': [editionAppGroup(edition.config.bundleId)],
      },
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      ['expo-font', { fonts: editionFonts(edition.dir, projectRoot) }],
      ['expo-splash-screen', editionSplash(edition.dir, projectRoot)],
      [
        'expo-notifications',
        { sounds: editionNotificationSounds(edition.dir, projectRoot, edition.config) },
      ],
      '@react-native-community/datetimepicker',
      ['expo-build-properties', { ios: { deploymentTarget: '17.0' } }],
      // The widget extension, from apps/widget/expo-target.config.json (ADR 0026).
      ['@bacons/apple-targets', { root: '..', match: 'widget' }],
    ],
    extra: {
      edition: { id: edition.config.id },
      // The EAS project @anton_de/slovo.
      eas: { projectId: 'e2401ef2-2a47-407e-b0ff-03706421b71c' },
    },
  };
  return withWidgetExtension(expoConfig, join(projectRoot, '../widget'), widget);
};
