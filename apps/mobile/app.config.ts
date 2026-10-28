import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import type * as Contracts from '@slovo/contracts';
import type * as EditionFolders from '@slovo/language-pack/edition';
import type * as UiTokens from '@slovo/ui/tokens';
import type * as Core from '@slovo/core';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import type * as ConfigPlugins from 'expo/config-plugins';
import { require as tsxRequire } from 'tsx/cjs/api';

import type * as NotificationSound from './plugins/notification-sound';
import type * as WidgetExtension from './plugins/widget-extension';

type EditionFolder = EditionFolders.EditionFolder;

/** The options of the `expo-splash-screen` config plugin that the config sets. */
interface SplashPluginOptions {
  image?: string;
  backgroundColor: string;
  imageWidth?: number;
  dark: { image?: string; backgroundColor: string };
}

// Expo evaluates this file with plain Node, which cannot load the TypeScript
// sources of the workspace packages (their relative imports have no file
// extension). tsx loads them, so the Edition is read by the same module, and
// checked by the same schemas, as the Language Pack build and the app.
const { editionAppGroup } = tsxRequire('@slovo/contracts', import.meta.url) as typeof Contracts;
const { EditionFolderError, listEditions, openEdition } = tsxRequire(
  '@slovo/language-pack/edition',
  import.meta.url,
) as typeof EditionFolders;
const { loadDecor } = tsxRequire('@slovo/core', import.meta.url) as typeof Core;
const { withDangerousMod } = tsxRequire(
  'expo/config-plugins',
  import.meta.url,
) as typeof ConfigPlugins;
const { readNotificationSound } = tsxRequire(
  './plugins/notification-sound.ts',
  import.meta.url,
) as typeof NotificationSound;
const { coreTokens, designTokens } = tsxRequire(
  '@slovo/ui/tokens',
  import.meta.url,
) as typeof UiTokens;
const { writeWidgetExtension } = tsxRequire(
  './plugins/widget-extension.ts',
  import.meta.url,
) as typeof WidgetExtension;

/**
 * The one mobile shell builds whichever Edition the SLOVO_EDITION environment
 * variable selects. Everything Edition-specific in the native app comes from
 * the Edition folder; a missing or unknown Edition stops the build.
 */
const EDITION_VARIABLE = 'SLOVO_EDITION';

/**
 * The Core shows nothing in Decor slot 7: its splash is a plain screen in the
 * Core's neutral background colours (docs/design/design-system.md).
 */
const CORE_SPLASH: SplashPluginOptions = {
  backgroundColor: coreTokens.colors.light.background,
  dark: { backgroundColor: coreTokens.colors.dark.background },
};

/** The splash from the Edition's Decor (`decor/splash.json`), or the Core's plain one. */
function editionSplash(edition: EditionFolder, projectRoot: string): SplashPluginOptions {
  const splash = edition.readIfPresent('splash');
  if (splash === undefined) return CORE_SPLASH;
  const { imageWidth, light, dark } = splash;
  const image = (name: string) => {
    const path = edition.decorFile(name);
    if (!existsSync(path))
      throw new Error(`${edition.path('splash')} names a missing splash image: expected ${path}`);
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
function editionNotificationSounds(edition: EditionFolder, projectRoot: string): string[] {
  const { notificationSound } = edition.config;
  if (notificationSound === undefined) return [];
  const file = edition.asset(notificationSound);
  if (!existsSync(file)) {
    throw new Error(
      `${edition.path('config')} names no notification sound that exists: expected ${file}`,
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

/**
 * What the widget extension takes from the Edition, checked here so a broken
 * Edition stops the config rather than the native build. The files
 * themselves are made at prebuild (`widget-extension.ts`).
 */
function widgetEdition(edition: EditionFolder, scheme: string): WidgetExtension.WidgetEdition {
  // The example the widget gallery shows must be there and be a valid Widget Snapshot.
  edition.read('widgetSnapshotExample');
  return {
    config: edition.config,
    scheme,
    strings: edition.read('strings').widget,
    tokens: designTokens(edition.readIfPresent('tokens') ?? {}),
    band: loadDecor(edition.readIfPresent('decor')).divider.band,
    fontFiles: edition.fonts(),
    exampleSnapshot: edition.path('widgetSnapshotExample'),
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

/** The build's Google client id for iOS, as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` names it (ADR 0047). */
const GOOGLE_CLIENT_ID_VARIABLE = 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID';
const GOOGLE_CLIENT_ID_SUFFIX = '.apps.googleusercontent.com';

/**
 * Google's sign-in SDK with the URL scheme its sheet returns to, the client
 * id reversed, when the build has a Google client id for iOS; nothing
 * without one, and «Увійти через Google» stays hidden. The id comes from the
 * build's environment, never the repository.
 */
function googleSignIn(): NonNullable<ExpoConfig['plugins']> {
  // Expo types every environment variable as `any`; narrow it here.
  const value: unknown = process.env[GOOGLE_CLIENT_ID_VARIABLE];
  if (typeof value !== 'string' || value === '') return [];
  if (!value.endsWith(GOOGLE_CLIENT_ID_SUFFIX)) {
    throw new Error(
      `${GOOGLE_CLIENT_ID_VARIABLE} is not a Google client id for iOS: expected one ending in ${GOOGLE_CLIENT_ID_SUFFIX}`,
    );
  }
  const iosUrlScheme = `com.googleusercontent.apps.${value.slice(0, -GOOGLE_CLIENT_ID_SUFFIX.length)}`;
  return [['@react-native-google-signin/google-signin', { iosUrlScheme }]];
}

function selectEdition(editionsDir: string): EditionFolder {
  const known = listEditions(editionsDir);
  const hint = `Known Editions: ${known.join(', ')}. Example: ${EDITION_VARIABLE}=${known[0] ?? '<edition>'} pnpm start`;
  // Expo types every environment variable as `any`; narrow it here.
  const value: unknown = process.env[EDITION_VARIABLE];
  const id = typeof value === 'string' ? value : undefined;
  if (id === undefined || id === '') {
    throw new Error(`${EDITION_VARIABLE} is not set, so there is no Edition to build.\n${hint}`);
  }
  try {
    return openEdition(editionsDir, id);
  } catch (error) {
    if (error instanceof EditionFolderError && error.reason === 'unknown') {
      throw new Error(`Unknown Edition "${id}" in ${EDITION_VARIABLE}.\n${hint}`, { cause: error });
    }
    throw error;
  }
}

export default ({ config, projectRoot }: ConfigContext): ExpoConfig => {
  const edition = selectEdition(join(projectRoot, '../../editions'));
  const [language] = edition.config.locale.split('-');
  const icon = edition.path('icon');
  if (!existsSync(icon)) {
    throw new Error(`Edition "${edition.config.id}" has no icon: expected ${icon}`);
  }

  const scheme = `slovo-${edition.config.id}`;
  const widget = widgetEdition(edition, scheme);

  const expoConfig: ExpoConfig = {
    ...config,
    name: edition.config.displayName,
    slug: 'slovo',
    owner: 'anton_de',
    version: '0.8.14',
    scheme,
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: relative(projectRoot, icon),
    // Memoises components and hooks at build time; modules with Reanimated or
    // gesture code opt out with 'use no memo' (ADR 0059).
    experiments: { reactCompiler: true },
    ios: {
      bundleIdentifier: edition.config.bundleId,
      supportsTablet: false,
      infoPlist: {
        CFBundleDevelopmentRegion: language,
        CFBundleLocalizations: [language],
        ITSAppUsesNonExemptEncryption: false,
      },
      entitlements: {
        // The widget extension gets the same App Group from the Apple targets plugin.
        'com.apple.security.application-groups': [editionAppGroup(edition.config.bundleId)],
        // Collection Links, https://<linkDomain>/c/<id>, open in the app (ADR 0058).
        'com.apple.developer.associated-domains': [`applinks:${edition.config.linkDomain}`],
      },
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      // Every font file the Edition brings, embedded in the native app.
      ['expo-font', { fonts: edition.fonts().map((font) => relative(projectRoot, font)) }],
      ['expo-splash-screen', editionSplash(edition, projectRoot)],
      ['expo-notifications', { sounds: editionNotificationSounds(edition, projectRoot) }],
      '@react-native-community/datetimepicker',
      ['expo-build-properties', { ios: { deploymentTarget: '17.0' } }],
      // The widget extension, from apps/widget/expo-target.config.json (ADR 0026).
      ['@bacons/apple-targets', { root: '..', match: 'widget' }],
      ...googleSignIn(),
    ],
    extra: {
      edition: { id: edition.config.id },
      // The EAS project @anton_de/slovo.
      eas: { projectId: 'e2401ef2-2a47-407e-b0ff-03706421b71c' },
    },
  };
  return withWidgetExtension(expoConfig, join(projectRoot, '../widget'), widget);
};
