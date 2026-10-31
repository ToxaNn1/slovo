import { existsSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import type * as Contracts from '@slovo/contracts';
import type * as EditionFolders from '@slovo/language-pack/edition';
import type * as UiFonts from '@slovo/ui/fonts';
import type * as UiTokens from '@slovo/ui/tokens';
import type * as Core from '@slovo/core';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import type * as ConfigPlugins from 'expo/config-plugins';
import { require as tsxRequire } from 'tsx/cjs/api';

import type * as AppIntents from './plugins/app-intents';
import type * as FontFamily from './plugins/font-family';
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
const { IOSConfig, withDangerousMod, withXcodeProject } = tsxRequire(
  'expo/config-plugins',
  import.meta.url,
) as typeof ConfigPlugins;
const { appIntentTitles, writeAppIntents } = tsxRequire(
  './plugins/app-intents.ts',
  import.meta.url,
) as typeof AppIntents;
const { readFontFamily } = tsxRequire(
  './plugins/font-family.ts',
  import.meta.url,
) as typeof FontFamily;
const { readNotificationSound } = tsxRequire(
  './plugins/notification-sound.ts',
  import.meta.url,
) as typeof NotificationSound;
const { coreFonts } = tsxRequire('@slovo/ui/fonts', import.meta.url) as typeof UiFonts;
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
 * The family of the Word of the Day font the Edition names, which the app
 * sets the Lemma on the Word of the Day card in (ADR 0006). It is one of
 * the Edition's own fonts, never one of the Core's (ADR 0061).
 */
function wordOfTheDayFontFamily(edition: EditionFolder): string {
  const name = edition.config.wordOfTheDayFont;
  const file = edition.fonts().find((font) => basename(font) === name);
  if (file === undefined) {
    throw new Error(
      `${edition.path('config')} names a wordOfTheDayFont that is not among the Edition's fonts: ${name}`,
    );
  }
  const family = readFontFamily(readFileSync(file));
  if (family === undefined) throw new Error(`${file} has no family name: is it a font?`);
  return family;
}

/** Every font file the app embeds: the Core's, then the Edition's own (ADR 0061). */
function appFonts(edition: EditionFolder): string[] {
  return [...coreFonts(), ...edition.fonts()];
}

/**
 * What the widget extension takes from the Edition, checked here so a broken
 * Edition stops the config rather than the native build. The files
 * themselves are made at prebuild (`widget-extension.ts`).
 */
function widgetEdition(edition: EditionFolder, scheme: string): WidgetExtension.WidgetEdition {
  // The example the widget gallery shows must be there and be a valid Widget Snapshot.
  edition.read('widgetSnapshotExample');
  const tokens = designTokens(edition.readIfPresent('tokens') ?? {});
  // The widget draws in the word and UI families alone, so the Word of the Day font stays out.
  const families = new Set(Object.values(tokens.fontFamilies));
  return {
    config: edition.config,
    scheme,
    strings: edition.read('strings').widget,
    tokens,
    band: loadDecor(edition.readIfPresent('decor')).divider.band,
    fontFiles: appFonts(edition).filter((font) => {
      const family = readFontFamily(readFileSync(font));
      return family !== undefined && families.has(family);
    }),
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

/**
 * Compiles the App Intents and their App Shortcuts, made from the Edition's
 * strings, into the app's target at prebuild (ADR 0057).
 */
function withAppIntents(config: ExpoConfig, edition: AppIntents.AppIntentsEdition): ExpoConfig {
  return withXcodeProject(config, (modConfig) => {
    const { platformProjectRoot, projectName = '' } = modConfig.modRequest;
    writeAppIntents({ iosDir: platformProjectRoot, projectName }, edition, (filepath) => {
      // Expo skips a file already in the group, from an earlier prebuild.
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath,
        groupName: projectName,
        project: modConfig.modResults,
      });
    });
    return modConfig;
  });
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

/** The backend's address the bundle carries (`src/api.ts`). */
const API_URL_VARIABLE = 'EXPO_PUBLIC_SLOVO_API_URL';

/** How the app is being built: by EAS with a profile, or by Metro outside EAS. */
type Build = { kind: 'release' | 'development'; profile: string } | { kind: 'metro' };

/**
 * Every EAS build profile but a development one (`development…`) builds a
 * release; without a profile, Metro (or `eas update`) runs outside an EAS build.
 */
function currentBuild(): Build {
  // Expo types every environment variable as `any`; narrow it here.
  const profile: unknown = process.env['EAS_BUILD_PROFILE'];
  if (typeof profile !== 'string' || profile === '') return { kind: 'metro' };
  return { kind: profile.startsWith('development') ? 'development' : 'release', profile };
}

/**
 * Refuses a release build that would talk to localhost or over plain HTTP:
 * a release must carry an `https://` API address. Development builds and
 * Metro outside EAS keep the localhost fallback.
 */
function requireReleaseApiUrl(build: Build): void {
  if (build.kind !== 'release') return;
  const { profile } = build;
  const value: unknown = process.env[API_URL_VARIABLE];
  if (typeof value !== 'string' || value === '') {
    throw new Error(
      `${API_URL_VARIABLE} is not set, so the release build "${profile}" would talk to localhost: set it to the backend's https:// address`,
    );
  }
  if (!value.startsWith('https://')) {
    throw new Error(
      `${API_URL_VARIABLE} is "${value}", but the release build "${profile}" needs an https:// address`,
    );
  }
}

/** The EAS project @anton_de/slovo. */
const EAS_PROJECT_ID = 'e2401ef2-2a47-407e-b0ff-03706421b71c';

/** The public code-signing certificate of OTA updates; its private key lives in EAS only. */
const UPDATES_CERTIFICATE = './certs/certificate.pem';

/**
 * OTA updates (ADR 0062): on launch the app checks the Edition's channel,
 * waits a few seconds at most and otherwise starts the code it has; it
 * accepts only an update signed with SLOVO's key and made for its native
 * code (the fingerprint runtime version). A development build takes no
 * updates, and a release refuses to build without the certificate.
 */
function updates(
  build: Build,
  channel: string,
  projectRoot: string,
): Pick<ExpoConfig, 'runtimeVersion' | 'updates'> {
  const certificate = join(projectRoot, UPDATES_CERTIFICATE);
  const signed = existsSync(certificate);
  if (!signed && build.kind === 'release') {
    throw new Error(
      `The release build "${build.profile}" has no code-signing certificate for OTA updates: expected ${certificate}`,
    );
  }
  return {
    runtimeVersion: { policy: 'fingerprint' },
    updates: {
      enabled: build.kind !== 'development',
      url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
      requestHeaders: { 'expo-channel-name': channel },
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 3000,
      ...(signed && {
        codeSigningCertificate: UPDATES_CERTIFICATE,
        codeSigningMetadata: { keyid: 'main', alg: 'rsa-v1_5-sha256' },
      }),
    },
  };
}

/**
 * Opens the Edition the build selects. A release build opens it for a
 * release, which refuses the placeholders a development build keeps, such as
 * the `slovo.example` domain and an empty Apple Team ID.
 */
function selectEdition(editionsDir: string, build: Build): EditionFolder {
  const known = listEditions(editionsDir);
  const hint = `Known Editions: ${known.join(', ')}. Example: ${EDITION_VARIABLE}=${known[0] ?? '<edition>'} pnpm start`;
  // Expo types every environment variable as `any`; narrow it here.
  const value: unknown = process.env[EDITION_VARIABLE];
  const id = typeof value === 'string' ? value : undefined;
  if (id === undefined || id === '') {
    throw new Error(`${EDITION_VARIABLE} is not set, so there is no Edition to build.\n${hint}`);
  }
  try {
    return openEdition(editionsDir, id, {
      build: build.kind === 'release' ? 'release' : 'development',
    });
  } catch (error) {
    if (error instanceof EditionFolderError && error.reason === 'unknown') {
      throw new Error(`Unknown Edition "${id}" in ${EDITION_VARIABLE}.\n${hint}`, { cause: error });
    }
    throw error;
  }
}

export default ({ config, projectRoot }: ConfigContext): ExpoConfig => {
  const build = currentBuild();
  requireReleaseApiUrl(build);
  const edition = selectEdition(join(projectRoot, '../../editions'), build);
  const [language] = edition.config.locale.split('-');
  const icon = edition.path('icon');
  if (!existsSync(icon)) {
    throw new Error(`Edition "${edition.config.id}" has no icon: expected ${icon}`);
  }

  const scheme = `slovo-${edition.config.id}`;
  const widget = widgetEdition(edition, scheme);
  const appIntents: AppIntents.AppIntentsEdition = {
    displayName: edition.config.displayName,
    strings: edition.read('strings').appIntents,
  };

  const expoConfig: ExpoConfig = {
    ...config,
    name: edition.config.displayName,
    slug: 'slovo',
    owner: 'anton_de',
    version: '0.9',
    scheme,
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: relative(projectRoot, icon),
    // Memoises components and hooks at build time; modules with Reanimated or
    // gesture code opt out with 'use no memo' (ADR 0059).
    experiments: { reactCompiler: true },
    ...updates(build, edition.config.updateChannel, projectRoot),
    ios: {
      bundleIdentifier: edition.config.bundleId,
      supportsTablet: false,
      // Sign in with Apple (ADR 0047): the bundle id is SLOVO's client id at Apple.
      usesAppleSignIn: true,
      infoPlist: {
        CFBundleDevelopmentRegion: language,
        CFBundleLocalizations: [language],
        ITSAppUsesNonExemptEncryption: false,
        // The local Spotlight module (`modules/spotlight`, ADR 0057) opens a
        // tapped search result as the link `<scheme>://<route>`.
        SlovoLinkScheme: scheme,
      },
      entitlements: {
        // The widget extension gets the same App Group from the Apple targets plugin.
        'com.apple.security.application-groups': [editionAppGroup(edition.config.bundleId)],
        // Collection Links, https://<linkDomain>/c/<id>, open in the app (ADR 0058).
        'com.apple.developer.associated-domains': [`applinks:${edition.config.linkDomain}`],
        // «Увійти через Apple» on the SLOVO ID screen (ADR 0047).
        'com.apple.developer.applesignin': ['Default'],
      },
    },
    // The App Intents' titles, which their Swift code names by key (ADR 0057).
    locales: {
      [language ?? edition.config.locale]: {
        ios: { 'Localizable.strings': appIntentTitles(appIntents.strings) },
      },
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      // The Core's fonts and the Edition's own, embedded in the native app.
      ['expo-font', { fonts: appFonts(edition).map((font) => relative(projectRoot, font)) }],
      ['expo-splash-screen', editionSplash(edition, projectRoot)],
      ['expo-notifications', { sounds: editionNotificationSounds(edition, projectRoot) }],
      '@react-native-community/datetimepicker',
      ['expo-build-properties', { ios: { deploymentTarget: '17.0' } }],
      // The widget extension, from apps/widget/expo-target.config.json (ADR 0026).
      ['@bacons/apple-targets', { root: '..', match: 'widget' }],
      ...googleSignIn(),
    ],
    extra: {
      edition: { id: edition.config.id, wordOfTheDayFontFamily: wordOfTheDayFontFamily(edition) },
      eas: { projectId: EAS_PROJECT_ID },
    },
  };
  return withAppIntents(
    withWidgetExtension(expoConfig, join(projectRoot, '../widget'), widget),
    appIntents,
  );
};
