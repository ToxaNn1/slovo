import { existsSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import type * as EditionFolders from '@slovo/language-pack/edition';
import type * as UiTokens from '@slovo/ui/tokens';
import type * as Contracts from '@slovo/contracts';
import type * as Core from '@slovo/core';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import type * as ConfigPlugins from 'expo/config-plugins';
import { require as tsxRequire } from 'tsx/cjs/api';

import type * as AppIntents from './plugins/app-intents';
import type * as FontFamily from './plugins/font-family';
import type * as NotificationSound from './plugins/notification-sound';
import type * as SplashBackground from './plugins/splash-background';
import type * as WidgetExtension from './plugins/widget-extension';

type EditionFolder = EditionFolders.EditionFolder;
type AppFolder = EditionFolders.AppFolder;

/** The options of the `expo-splash-screen` config plugin that the config sets. */
interface SplashPluginOptions {
  backgroundColor: string;
  dark: { backgroundColor: string };
}

// Expo evaluates this file with plain Node, which cannot load the TypeScript
// sources of the workspace packages (their relative imports have no file
// extension). tsx loads them, so the Edition is read by the same module, and
// checked by the same schemas, as the Language Pack build and the app.
const { EditionFolderError, listEditions, openAppConfig, openEditionWithoutRecords } = tsxRequire(
  '@slovo/language-pack/edition',
  import.meta.url,
) as typeof EditionFolders;
const { loadDecor } = tsxRequire('@slovo/core', import.meta.url) as typeof Core;
const { UpdateChannelSchema } = tsxRequire('@slovo/contracts', import.meta.url) as typeof Contracts;
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
const { withSplashBackground } = tsxRequire(
  './plugins/splash-background.ts',
  import.meta.url,
) as typeof SplashBackground;
const { designTokens } = tsxRequire('@slovo/ui/tokens', import.meta.url) as typeof UiTokens;
const { writeWidgetExtension } = tsxRequire(
  './plugins/widget-extension.ts',
  import.meta.url,
) as typeof WidgetExtension;

/** The native splash the AppConfig names: a plain colour in each Theme. */
function appSplash(app: AppFolder): SplashPluginOptions {
  const { light, dark } = app.splash();
  return {
    backgroundColor: light.backgroundColor,
    dark: { backgroundColor: dark.backgroundColor },
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
 * the Edition's own fonts, never one of the Core's (ADR 0006).
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

/**
 * What the widget extension takes from the Edition, checked here so a broken
 * Edition stops the config rather than the native build. The files
 * themselves are made at prebuild (`widget-extension.ts`).
 */
function widgetEdition(
  edition: EditionFolder,
  { scheme, appGroup }: AppFolder['config'],
): WidgetExtension.WidgetEdition {
  // The example the widget gallery shows must be there and be a valid Widget
  // Snapshot of this Edition, since the widget shows only the Edition's own.
  const example = edition.read('widgetSnapshotExample');
  if (example.editionId !== edition.config.id) {
    throw new Error(
      `${edition.path('widgetSnapshotExample')} is the Widget Snapshot of the Edition "${example.editionId}", not of "${edition.config.id}"`,
    );
  }
  const tokens = designTokens(edition.readIfPresent('tokens') ?? {});
  // The widget draws in the word and UI families alone, so the Word of the Day font stays out.
  const families = new Set(Object.values(tokens.fontFamilies));
  return {
    config: edition.config,
    scheme,
    appGroup,
    strings: edition.read('strings').widget,
    tokens,
    mascot: loadDecor(edition.readIfPresent('decor')).mascot,
    fontFiles: edition.fonts().filter((font) => {
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
 * strings, into the app's target at prebuild.
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

/**
 * Refuses a release build whose profile in `eas.json` names no Update channel
 * or one that is neither `beta` nor `production` (ADR 0167). EAS writes the
 * profile's channel into the native project, so the channel never enters this
 * config and both store profiles get the same fingerprint (ADR 0062).
 */
function requireReleaseChannel(build: Build, projectRoot: string): void {
  if (build.kind !== 'release') return;
  const { profile } = build;
  const channel = profileChannel(projectRoot, profile);
  const channels = UpdateChannelSchema.options.join(', ');
  if (channel === undefined) {
    throw new Error(
      `The release build "${profile}" names no Update channel: give its profile in eas.json a "channel", one of ${channels}`,
    );
  }
  if (!UpdateChannelSchema.safeParse(channel).success) {
    throw new Error(
      `The release build "${profile}" names the Update channel ${JSON.stringify(channel)} in eas.json, but a release listens to one of ${channels}`,
    );
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * The `channel` the build profile names in `eas.json`, itself or through the
 * profiles it `extends`, unchecked, or undefined.
 */
function profileChannel(projectRoot: string, profile: string): unknown {
  const eas: unknown = JSON.parse(readFileSync(join(projectRoot, 'eas.json'), 'utf8'));
  const profiles = isRecord(eas) ? eas['build'] : undefined;
  const seen = new Set<string>();
  let name: unknown = profile;
  while (typeof name === 'string' && !seen.has(name)) {
    seen.add(name);
    const settings = isRecord(profiles) ? profiles[name] : undefined;
    if (!isRecord(settings)) return undefined;
    if (settings['channel'] !== undefined) return settings['channel'];
    name = settings['extends'];
  }
  return undefined;
}

/** The EAS project @slovo-app/slovo. */
const EAS_PROJECT_ID = 'e2401ef2-2a47-407e-b0ff-03706421b71c';

/** The public code-signing certificate of OTA updates; its private key lives in EAS only. */
const UPDATES_CERTIFICATE = './certs/certificate.pem';

/**
 * OTA updates (ADR 0062, 0167): on launch the app checks its build's Update
 * channel, which EAS writes into the native project from the build profile,
 * waits a few seconds at most and otherwise starts the code it has; it
 * accepts only an update signed with SLOVO's key and made for its native
 * code (the fingerprint runtime version). A release refuses to build without
 * the certificate.
 *
 * The block is the same for every build, so the fingerprint eas-cli computes
 * on the laptop, where no `EAS_BUILD_PROFILE` is set, matches the one the EAS
 * build computes (#1498). A development build names no channel and takes
 * no update: its Debug configuration loads the bundle from Metro through the
 * development client.
 */
function updates(
  build: Build,
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
      enabled: true,
      url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
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
 * Opens the Edition the app bundles, the AppConfig's default Edition (ADR
 * 0065): every build of the one app bundles the same one, so no build names
 * an Edition.
 */
function bundledEdition(editionsDir: string, app: AppFolder): EditionFolder {
  const id = app.config.defaultEdition;
  try {
    return openEditionWithoutRecords(editionsDir, id);
  } catch (error) {
    if (error instanceof EditionFolderError && error.reason === 'unknown') {
      throw new Error(
        `app/app.json names the defaultEdition "${id}", which is not an Edition.\nKnown Editions: ${listEditions(editionsDir).join(', ')}`,
        { cause: error },
      );
    }
    throw error;
  }
}

/**
 * Opens the AppConfig, the identity of the one app (ADR 0065). A release
 * build refuses its placeholders, such as the `slovo.example` domain and an
 * empty Apple Team ID.
 */
function openApp(repoDir: string, build: Build): AppFolder {
  const app = openAppConfig(repoDir, {
    build: build.kind === 'release' ? 'release' : 'development',
  });
  const icon = app.path('icon');
  if (!existsSync(icon)) throw new Error(`The app has no icon: expected ${icon}`);
  return app;
}

export default ({ config, projectRoot }: ConfigContext): ExpoConfig => {
  const build = currentBuild();
  requireReleaseApiUrl(build);
  requireReleaseChannel(build, projectRoot);
  const repoDir = join(projectRoot, '../..');
  const app = openApp(repoDir, build);
  const edition = bundledEdition(join(repoDir, 'editions'), app);
  const { name, scheme, bundleId, appGroup, domain } = app.config;
  const [language] = edition.config.locale.split('-');

  const widget = widgetEdition(edition, app.config);
  const appIntents: AppIntents.AppIntentsEdition = {
    editionId: edition.config.id,
    displayName: edition.config.displayName,
    strings: edition.read('strings').appIntents,
  };

  const expoConfig: ExpoConfig = {
    ...config,
    name,
    slug: 'slovo',
    owner: 'slovo-app',
    version: '0.9',
    scheme,
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: relative(projectRoot, app.path('icon')),
    // Memoises components and hooks at build time; modules with Reanimated or
    // gesture code opt out with 'use no memo'.
    experiments: { reactCompiler: true },
    ...updates(build, projectRoot),
    ios: {
      bundleIdentifier: bundleId,
      supportsTablet: false,
      // Sign in with Apple (ADR 0047): the bundle id is SLOVO's client id at Apple.
      usesAppleSignIn: true,
      infoPlist: {
        CFBundleDevelopmentRegion: language,
        CFBundleLocalizations: [language],
        ITSAppUsesNonExemptEncryption: false,
        // The local Spotlight module (`modules/spotlight`) opens a
        // tapped search result as the link `<scheme>://<route>`.
        SlovoLinkScheme: scheme,
      },
      entitlements: {
        // The widget extension gets the same App Group from the Apple targets plugin.
        'com.apple.security.application-groups': [appGroup],
        // Collection Links, https://<domain>/<edition>/c/<id>, open in the app.
        'com.apple.developer.associated-domains': [`applinks:${domain}`],
        // «Увійти через Apple» on the SLOVO ID screen (ADR 0047).
        'com.apple.developer.applesignin': ['Default'],
      },
    },
    // The App Intents' titles, which their Swift code names by key.
    locales: {
      [language ?? edition.config.locale]: {
        ios: { 'Localizable.strings': appIntentTitles(appIntents.strings) },
      },
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      // The Edition's fonts, embedded in the native app; the Core brings none (ADR 0006).
      ['expo-font', { fonts: edition.fonts().map((font) => relative(projectRoot, font)) }],
      ['expo-splash-screen', appSplash(app)],
      ['expo-notifications', { sounds: editionNotificationSounds(edition, projectRoot) }],
      // The Interface sounds play in the foreground only and record nothing.
      [
        'expo-audio',
        { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false },
      ],
      '@react-native-community/datetimepicker',
      ['expo-build-properties', { ios: { deploymentTarget: '17.0' } }],
      // The widget extension, from apps/widget/expo-target.config.json.
      ['@bacons/apple-targets', { root: '..', match: 'widget' }],
      ...googleSignIn(),
    ],
    extra: {
      // The app chooses its active Edition at launch (ADR 0065), so the build names none here.
      edition: { wordOfTheDayFontFamily: wordOfTheDayFontFamily(edition) },
      eas: { projectId: EAS_PROJECT_ID },
    },
  };
  return withAppIntents(
    withWidgetExtension(
      // The launch screen in the splash colour, once expo-splash-screen has written it.
      withSplashBackground(expoConfig),
      join(projectRoot, '../widget'),
      widget,
    ),
    appIntents,
  );
};
