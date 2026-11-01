import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  APP_CONFIG_FILE,
  EDITIONS_DIR,
  FONTS_DIR,
  openAppConfig,
  openEdition,
  REPO_DIR,
  type EditionFolder,
} from '@slovo/language-pack/edition';
import { coreFonts } from '@slovo/ui/fonts';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import { compileModsAsync } from 'expo/config-plugins';
import { afterEach, describe, expect, it, vi } from 'vitest';

import appConfig from './app.config';
import { APP_INTENTS_SOURCE } from './plugins/app-intents';
import { wav } from './plugins/wav-builder';

const context: ConfigContext = {
  projectRoot: fileURLToPath(new URL('.', import.meta.url)),
  staticConfigPath: null,
  packageJsonPath: null,
  config: {},
};

const ukrainian = openEdition(EDITIONS_DIR, 'uk');
const app = openAppConfig(REPO_DIR);

const temporaryRepos: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const repo of temporaryRepos.splice(0)) rmSync(repo, { recursive: true, force: true });
});

/**
 * A throwaway repo layout (`apps/mobile` next to `editions/uk` and the
 * AppConfig) holding a copy of the UA Edition with its config changed by
 * `edit` and of the AppConfig changed by `editApp`. The icon is copied unless
 * `withIcon` is false; `change` may then edit the copies.
 */
function repoWithEdition(
  edit: (config: Record<string, unknown>) => void,
  {
    withIcon = true,
    editApp = () => undefined,
    change = () => undefined,
  }: {
    withIcon?: boolean;
    editApp?: (config: Record<string, unknown>) => void;
    change?: (edition: EditionFolder, appFile: (file: 'icon' | 'splash') => string) => void;
  } = {},
): ConfigContext {
  const repo = mkdtempSync(join(tmpdir(), 'slovo-app-config-'));
  temporaryRepos.push(repo);
  const projectRoot = join(repo, 'apps/mobile');
  mkdirSync(projectRoot, { recursive: true });
  // The app config reads no Entries, so the content folder stays behind.
  const contentDir = dirname(ukrainian.path('manifest'));
  cpSync(ukrainian.dir, join(repo, 'editions/uk'), {
    recursive: true,
    filter: (source) => !source.startsWith(contentDir),
  });
  const copy = openEdition(join(repo, 'editions'), 'uk');
  const config = JSON.parse(readFileSync(copy.path('config'), 'utf8')) as Record<string, unknown>;
  edit(config);
  writeFileSync(copy.path('config'), JSON.stringify(config));
  mkdirSync(join(repo, dirname(APP_CONFIG_FILE)));
  cpSync(join(REPO_DIR, APP_CONFIG_FILE), join(repo, APP_CONFIG_FILE));
  const appJson = JSON.parse(readFileSync(join(repo, APP_CONFIG_FILE), 'utf8')) as Record<
    string,
    unknown
  >;
  editApp(appJson);
  writeFileSync(join(repo, APP_CONFIG_FILE), JSON.stringify(appJson));
  // Where the copy keeps a file the AppConfig names, read without checking it.
  const appFile = (file: 'icon' | 'splash') => join(repo, String(appJson[file]));
  if (!withIcon) rmSync(appFile('icon'));
  change(copy, appFile);
  return { ...context, projectRoot };
}

/** The real domain and Apple Team ID the AppConfig check asks of a release build. */
function withReleaseApp(config: Record<string, unknown>): void {
  config['domain'] = 'slovo.app';
  config['appleTeamId'] = 'A1B2C3D4E5';
}

/**
 * A throwaway repo layout with an Edition ready for a release and the public
 * code-signing certificate of OTA updates in `apps/mobile/certs` (ADR 0062),
 * as a release build needs.
 */
function repoWithCertificate(): ConfigContext {
  const repo = repoWithEdition(() => undefined, { editApp: withReleaseApp });
  mkdirSync(join(repo.projectRoot, 'certs'));
  writeFileSync(
    join(repo.projectRoot, 'certs/certificate.pem'),
    '-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----\n',
  );
  return repo;
}

/** A JSON file of the copied Edition, changed by `edit`. */
function editJson(file: string, edit: (json: Record<string, unknown>) => unknown): void {
  writeFileSync(
    file,
    JSON.stringify(edit(JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>)),
  );
}

/** The options the config passes to the named config plugin. */
function pluginOptions(config: ExpoConfig, name: string): unknown {
  const plugin = config.plugins?.find(
    (entry) => (Array.isArray(entry) ? entry[0] : entry) === name,
  );
  return Array.isArray(plugin) ? plugin[1] : undefined;
}

/** The app's target in a native project as small as Expo's prebuild can change. */
const NATIVE_PROJECT = `// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 54;
	objects = {

/* Begin PBXBuildFile section */
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
/* End PBXFileReference section */

/* Begin PBXGroup section */
		A2 = {isa = PBXGroup; children = (A3 /* SLOVO */,); sourceTree = "<group>"; };
		A3 /* SLOVO */ = {isa = PBXGroup; children = (); name = SLOVO; sourceTree = "<group>"; };
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		A4 /* SLOVO */ = {isa = PBXNativeTarget; buildPhases = (A5 /* Sources */,); name = SLOVO; productName = SLOVO; productType = "com.apple.product-type.application"; };
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		A1 /* Project object */ = {isa = PBXProject; mainGroup = A2; targets = (A4 /* SLOVO */,); };
/* End PBXProject section */

/* Begin PBXSourcesBuildPhase section */
		A5 /* Sources */ = {isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; };
/* End PBXSourcesBuildPhase section */
	};
	rootObject = A1 /* Project object */;
}
`;

/**
 * Runs the native project changes the app config makes at prebuild on a
 * minimal native project in the context's folder, and returns that folder's
 * `ios`.
 */
async function prebuildIos(context: ConfigContext, times = 1): Promise<string> {
  const iosDir = join(context.projectRoot, 'ios');
  mkdirSync(join(iosDir, 'SLOVO.xcodeproj'), { recursive: true });
  writeFileSync(join(iosDir, 'SLOVO.xcodeproj/project.pbxproj'), NATIVE_PROJECT);
  for (let run = 0; run < times; run += 1) {
    await compileModsAsync(appConfig(context), {
      projectRoot: context.projectRoot,
      platforms: ['ios'],
      assertMissingModProviders: false,
    });
  }
  return iosDir;
}

/**
 * The bytes of a font with only a `name` table holding the Windows Unicode
 * records, in order: enough for the family to be read from it.
 */
function fontWithNames(
  records: readonly {
    readonly nameId: number;
    readonly languageId: number;
    readonly text: string;
  }[],
): Buffer {
  const texts = records.map(({ text }) => Buffer.from(text, 'utf16le').swap16());
  const table = Buffer.alloc(6 + 12 * records.length);
  table.writeUInt16BE(records.length, 2);
  table.writeUInt16BE(table.length, 4);
  let offset = 0;
  records.forEach(({ nameId, languageId }, index) => {
    const record = 6 + 12 * index;
    table.writeUInt16BE(3, record);
    table.writeUInt16BE(1, record + 2);
    table.writeUInt16BE(languageId, record + 4);
    table.writeUInt16BE(nameId, record + 6);
    table.writeUInt16BE(texts[index]?.length ?? 0, record + 8);
    table.writeUInt16BE(offset, record + 10);
    offset += texts[index]?.length ?? 0;
  });
  const header = Buffer.alloc(12 + 16);
  header.writeUInt16BE(1, 4);
  header.write('name', 12, 'latin1');
  header.writeUInt32BE(header.length, 12 + 8);
  return Buffer.concat([header, table, ...texts]);
}

describe('app config', () => {
  it("builds the AppConfig's default Edition, with no Edition named by the environment", () => {
    vi.stubEnv('SLOVO_EDITION', 'xx');

    expect(appConfig(context).ios?.infoPlist?.['CFBundleDevelopmentRegion']).toBe('uk');
  });

  it('fails clearly when the default Edition does not exist', () => {
    const unknown = repoWithEdition(() => undefined, {
      editApp: (config) => {
        config['defaultEdition'] = 'xx';
      },
    });

    expect(() => appConfig(unknown)).toThrow(
      /app\/app\.json names the defaultEdition "xx", which is not an Edition.*Known Editions: uk/s,
    );
  });

  it('refuses a default Edition that is not a plain folder name', () => {
    const outside = repoWithEdition(() => undefined, {
      editApp: (config) => {
        config['defaultEdition'] = '../uk';
      },
    });

    expect(() => appConfig(outside)).toThrow(/app\/app\.json › defaultEdition/);
  });

  it('takes the name, bundle id and icon from the AppConfig and the locale from the default Edition', () => {
    const config = appConfig(context);

    expect(config.name).toBe('SLOVO');
    expect(config.ios?.bundleIdentifier).toBe('app.slovo.uk');
    expect(config.icon).toMatch(/editions\/uk\/assets\/icon\.png$/);
    expect(config.ios?.infoPlist?.['CFBundleDevelopmentRegion']).toBe('uk');
  });

  it('carries the version of the milestone the code belongs to (ADR 0044)', () => {
    expect(appConfig(context).version).toBe('0.9');
  });

  it('turns on the React Compiler (ADR 0059)', () => {
    expect(appConfig(context).experiments?.reactCompiler).toBe(true);
  });

  it('names the field when the Edition config is invalid', () => {
    const broken = repoWithEdition((config) => {
      delete config['locale'];
      delete config['displayName'];
    });

    expect(() => appConfig(broken)).toThrow(
      /editions\/uk is not valid.*edition\.json › locale.*edition\.json › displayName/s,
    );
  });

  it('names the field when the AppConfig is invalid', () => {
    const broken = repoWithEdition(() => undefined, {
      editApp: (config) => {
        config['bundleId'] = 'NotReverseDns';
      },
    });

    expect(() => appConfig(broken)).toThrow(/AppConfig.*is not valid.*app\/app\.json › bundleId/s);
  });

  it('takes the name, scheme, bundle id and App Group from the AppConfig alone', () => {
    const renamed = repoWithEdition(
      (config) => {
        config['displayName'] = 'Інша назва';
      },
      {
        editApp: (config) => {
          config['name'] = 'SLOVO Next';
          config['scheme'] = 'slovo';
          config['bundleId'] = 'app.slovo.next';
        },
      },
    );

    const config = appConfig(renamed);

    expect(config.name).toBe('SLOVO Next');
    expect(config.scheme).toBe('slovo');
    expect(config.ios?.bundleIdentifier).toBe('app.slovo.next');
    expect(config.ios?.entitlements?.['com.apple.security.application-groups']).toEqual([
      'group.app.slovo.next',
    ]);
    expect(config.ios?.infoPlist?.['SlovoLinkScheme']).toBe('slovo');
  });

  it('rejects a config whose id differs from its folder name', () => {
    const mismatched = repoWithEdition((config) => {
      config['id'] = 'xx';
    });

    expect(() => appConfig(mismatched)).toThrow(/id "xx".*folder "uk"/s);
  });

  it('fails clearly when the app has no icon', () => {
    const withoutIcon = repoWithEdition(() => undefined, { withIcon: false });

    expect(() => appConfig(withoutIcon)).toThrow(/no icon.*editions\/uk\/assets\/icon\.png/s);
  });

  it('builds a config from a valid Edition copied elsewhere', () => {
    expect(appConfig(repoWithEdition(() => undefined)).ios?.bundleIdentifier).toBe('app.slovo.uk');
  });

  it("embeds the Core's fonts and the Edition's own in the native app", () => {
    const { fonts } = pluginOptions(appConfig(context), 'expo-font') as { fonts: string[] };

    expect(fonts).toEqual([
      ...[
        'Literata-Italic.ttf',
        'Literata-Medium.ttf',
        'Literata-Regular.ttf',
        'Literata-SemiBold.ttf',
        'Manrope-Bold.ttf',
        'Manrope-Medium.ttf',
        'Manrope-Regular.ttf',
        'Manrope-SemiBold.ttf',
      ].map((file) => `../../packages/ui/assets/fonts/${file}`),
      '../../editions/uk/assets/fonts/Kurale-Regular.ttf',
    ]);
  });

  it("embeds the Core's fonts alone for an Edition that brings none", () => {
    const repo = repoWithEdition(() => undefined, {
      change: (edition) => {
        // Its Word of the Day font is then one of the Core's, which it may not name.
        rmSync(join(edition.dir, FONTS_DIR), { recursive: true });
      },
    });

    expect(() => appConfig(repo)).toThrow(/not among the Edition's fonts: Kurale-Regular\.ttf/);
  });

  it('embeds the Word of the Day font and passes its family on to the app, naming no Edition', () => {
    const config = appConfig(context);
    const { fonts } = pluginOptions(config, 'expo-font') as { fonts: string[] };

    expect(fonts).toContain('../../editions/uk/assets/fonts/Kurale-Regular.ttf');
    // The app learns its active Edition at launch (ADR 0065), not from the build.
    expect(config.extra?.['edition']).toEqual({ wordOfTheDayFontFamily: 'Kurale' });
  });

  it('passes on the family of whichever font the Edition names for the Word of the Day', () => {
    const config = appConfig(
      repoWithEdition(
        (edition) => {
          edition['wordOfTheDayFont'] = 'Literata-Italic.ttf';
        },
        {
          change: (edition) => {
            const literata = coreFonts().find((font) => basename(font) === 'Literata-Italic.ttf');
            cpSync(literata ?? '', join(edition.dir, FONTS_DIR, 'Literata-Italic.ttf'));
          },
        },
      ),
    );

    expect(config.extra?.['edition']).toMatchObject({ wordOfTheDayFontFamily: 'Literata' });
  });

  it('passes on the English (US) family of a font that also names it in other languages', () => {
    const localised = repoWithEdition(() => undefined, {
      change(edition) {
        writeFileSync(
          join(edition.dir, FONTS_DIR, 'Kurale-Regular.ttf'),
          fontWithNames([
            { nameId: 1, languageId: 0x409, text: 'Kurale' },
            { nameId: 1, languageId: 0x422, text: 'Курале' },
          ]),
        );
      },
    });

    expect(appConfig(localised).extra?.['edition']).toMatchObject({
      wordOfTheDayFontFamily: 'Kurale',
    });
  });

  it('passes on the family in another language when the font has no English (US) one', () => {
    const localised = repoWithEdition(() => undefined, {
      change(edition) {
        writeFileSync(
          join(edition.dir, FONTS_DIR, 'Kurale-Regular.ttf'),
          fontWithNames([{ nameId: 1, languageId: 0x422, text: 'Курале' }]),
        );
      },
    });

    expect(appConfig(localised).extra?.['edition']).toMatchObject({
      wordOfTheDayFontFamily: 'Курале',
    });
  });

  it('fails clearly when the Word of the Day font is not among the Edition fonts', () => {
    const withoutFont = repoWithEdition(() => undefined, {
      change: (edition) => {
        rmSync(join(edition.dir, FONTS_DIR, 'Kurale-Regular.ttf'));
      },
    });

    expect(() => appConfig(withoutFont)).toThrow(/wordOfTheDayFont.*Kurale-Regular\.ttf/);
  });

  it('fails clearly when the Word of the Day font is not a font', () => {
    const notAFont = repoWithEdition(() => undefined, {
      change: (edition) => {
        writeFileSync(join(edition.dir, FONTS_DIR, 'Kurale-Regular.ttf'), 'not a font');
      },
    });

    expect(() => appConfig(notAFont)).toThrow(/Kurale-Regular\.ttf has no family name/);
  });

  it('takes the splash the AppConfig names in both Themes', () => {
    expect(pluginOptions(appConfig(context), 'expo-splash-screen')).toEqual({
      image: '../../editions/uk/decor/splash-light.png',
      backgroundColor: '#F5EEE2',
      imageWidth: 72,
      dark: { image: '../../editions/uk/decor/splash-dark.png', backgroundColor: '#15110E' },
    });
  });

  it('names the field when the splash Decor is invalid', () => {
    const broken = repoWithEdition(() => undefined, {
      change: (_, appFile) => {
        editJson(appFile('splash'), (splash) => ({
          ...splash,
          dark: { image: 'splash-dark.png', backgroundColor: 'black' },
        }));
      },
    });

    expect(() => appConfig(broken)).toThrow(
      /AppConfig.*is not valid.*decor\/splash\.json › dark\.backgroundColor/s,
    );
  });

  it('fails clearly when a splash image is missing', () => {
    const withoutImage = repoWithEdition(() => undefined, {
      change: (_, appFile) => {
        rmSync(join(dirname(appFile('splash')), 'splash-dark.png'));
      },
    });

    expect(() => appConfig(withoutImage)).toThrow(
      /splash image.*editions\/uk\/decor\/splash-dark\.png/s,
    );
  });

  it('bundles the notification sound of the Edition through expo-notifications', () => {
    expect(pluginOptions(appConfig(context), 'expo-notifications')).toEqual({
      sounds: ['../../editions/uk/assets/notification.wav'],
    });
  });

  it('bundles no sound when the Edition has none', () => {
    const withoutSound = repoWithEdition((config) => {
      delete config['notificationSound'];
    });

    expect(pluginOptions(appConfig(withoutSound), 'expo-notifications')).toEqual({ sounds: [] });
  });

  it('shares the App Group derived from the bundle id between the app and the widget', () => {
    expect(appConfig(context).ios?.entitlements?.['com.apple.security.application-groups']).toEqual(
      ['group.app.slovo.uk'],
    );
  });

  it('declares the Sign in with Apple entitlement (ADR 0047)', () => {
    const { ios } = appConfig(context);

    expect(ios?.usesAppleSignIn).toBe(true);
    expect(ios?.entitlements?.['com.apple.developer.applesignin']).toEqual(['Default']);
  });

  it("claims the app's domain for Collection Links (ADR 0058, 0065)", () => {
    const otherDomain = repoWithEdition(() => undefined, {
      editApp: (config) => {
        config['domain'] = 'links.slovo.test';
      },
    });

    expect(
      appConfig(otherDomain).ios?.entitlements?.['com.apple.developer.associated-domains'],
    ).toEqual(['applinks:links.slovo.test']);
  });

  it('adds the widget extension from apps/widget', () => {
    expect(pluginOptions(appConfig(context), '@bacons/apple-targets')).toEqual({
      root: '..',
      match: 'widget',
    });
  });

  it('bundles into the widget extension only the fonts of the families it draws with', async () => {
    const repo = repoWithEdition(() => undefined);

    await prebuildIos(repo);

    // The widget draws in the word and UI families of the tokens, never in the Word of the Day font.
    const generated = join(repo.projectRoot, '../widget/Generated');
    expect(readdirSync(generated).filter((file) => file.endsWith('.ttf'))).toEqual([
      'Literata-Italic.ttf',
      'Literata-Medium.ttf',
      'Literata-Regular.ttf',
      'Literata-SemiBold.ttf',
      'Manrope-Bold.ttf',
      'Manrope-Medium.ttf',
      'Manrope-Regular.ttf',
      'Manrope-SemiBold.ttf',
    ]);
  });

  it('fails clearly when the Edition has no example Widget Snapshot for the gallery', () => {
    const withoutExample = repoWithEdition(() => undefined, {
      change: (edition) => {
        rmSync(edition.path('widgetSnapshotExample'));
      },
    });

    expect(() => appConfig(withoutExample)).toThrow(
      /editions\/uk is not valid.*widget-snapshot\.example\.json: File not found/s,
    );
  });

  it('names the field when the example Widget Snapshot is invalid', () => {
    const broken = repoWithEdition(() => undefined, {
      change: (edition) => {
        editJson(edition.path('widgetSnapshotExample'), (example) => ({ ...example, format: 0 }));
      },
    });

    expect(() => appConfig(broken)).toThrow(/widget-snapshot\.example\.json › format/);
  });

  it('refuses an example Widget Snapshot of another Edition', () => {
    const other = repoWithEdition(() => undefined, {
      change: (edition) => {
        editJson(edition.path('widgetSnapshotExample'), (example) => ({
          ...example,
          editionId: 'en',
        }));
      },
    });

    expect(() => appConfig(other)).toThrow(
      /is the Widget Snapshot of the Edition "en", not of "uk"/,
    );
  });

  it('gives the widget extension the Edition id, so it shows only that Edition', async () => {
    const repo = repoWithEdition(() => undefined);

    await prebuildIos(repo);

    const info = readFileSync(join(repo.projectRoot, '../widget/Info.plist'), 'utf8');
    expect(info).toMatch(/<key>SLOVOEditionId<\/key>\s*<string>uk<\/string>/);
  });

  it("names the field when the widget's strings are missing", () => {
    const broken = repoWithEdition(() => undefined, {
      change: (edition) => {
        editJson(edition.path('strings'), (strings) => ({ ...strings, widget: {} }));
      },
    });

    expect(() => appConfig(broken)).toThrow(/strings\.json › widget\.galleryName/);
  });

  it("names the field when the widget palette's text is too faint for its background", () => {
    const faint = repoWithEdition((config) => {
      config['widgetPalette'] = {
        parchment: { background: '#F3E9D2', text: '#C8BBA0' },
        blue: { background: '#1F3A5F', text: '#F3E9D2' },
      };
    });

    expect(() => appConfig(faint)).toThrow(/widgetPalette\.parchment\.text/);
  });

  it('registers the native time picker', () => {
    expect(appConfig(context).plugins).toContain('@react-native-community/datetimepicker');
  });

  it('links the local Spotlight module, with its handler of a tap on a search result, into the native app', () => {
    // What Expo's autolinking hands the native build of this app (ADR 0057).
    const resolved = JSON.parse(
      execFileSync(
        join(context.projectRoot, 'node_modules/.bin/expo-modules-autolinking'),
        ['resolve', '--platform', 'apple', '--json'],
        { cwd: context.projectRoot, encoding: 'utf8' },
      ),
    ) as {
      modules: {
        packageName: string;
        pods: { podName: string }[];
        modules: { class: string }[];
        appDelegateSubscribers: string[];
      }[];
    };

    expect(resolved.modules.find(({ packageName }) => packageName === 'spotlight')).toMatchObject({
      pods: [{ podName: 'SlovoSpotlight' }],
      modules: [{ class: 'SpotlightModule' }],
      appDelegateSubscribers: ['SpotlightAppDelegateSubscriber'],
    });
  });

  it("gives the Spotlight module the app's scheme, so a tapped result opens as its link", () => {
    expect(appConfig(context).ios?.infoPlist?.['SlovoLinkScheme']).toBe('slovo');
  });

  it('opens every Edition under one scheme and one domain (ADR 0065)', () => {
    const config = appConfig(context);

    expect(config.scheme).toBe('slovo');
    expect(config.ios?.entitlements?.['com.apple.developer.associated-domains']).toEqual([
      'applinks:slovo.example',
    ]);
  });

  it('compiles the App Intents and their App Shortcuts into the app, however often it is prebuilt', async () => {
    // iOS reads App Shortcuts only from the app's own target, never from a pod (ADR 0057).
    const iosDir = await prebuildIos(
      repoWithEdition(() => undefined),
      2,
    );

    const project = readFileSync(join(iosDir, 'SLOVO.xcodeproj/project.pbxproj'), 'utf8');
    const sources = /isa = PBXSourcesBuildPhase;[^}]*files = \(([^)]*)\)/.exec(project)?.[1] ?? '';
    expect(sources.match(/\/\* (\S+) in Sources \*\//g)).toEqual([
      '/* SlovoAppIntents.swift in Sources */',
      '/* SlovoAppShortcuts.swift in Sources */',
    ]);
    expect(readFileSync(join(iosDir, 'SLOVO/SlovoAppIntents.swift'), 'utf8')).toBe(
      readFileSync(APP_INTENTS_SOURCE, 'utf8'),
    );
    // The app's group names no folder, as in Expo's template, so Xcode finds each file by its path from `ios`.
    const references = [...project.matchAll(/isa = PBXFileReference;[^}]*\bpath = "?([^";]+)"?;/g)];
    expect(references.map(([, path]) => path)).toEqual([
      'SLOVO/SlovoAppIntents.swift',
      'SLOVO/SlovoAppShortcuts.swift',
    ]);
  });

  it("gives Siri the Edition's phrases, each naming the app as Siri hears it, and each intent its route in the Edition", async () => {
    const iosDir = await prebuildIos(repoWithEdition(() => undefined));

    const shortcuts = readFileSync(join(iosDir, 'SLOVO/SlovoAppShortcuts.swift'), 'utf8');
    expect(shortcuts).toContain(
      'intent: WordOfTheDayIntent(),\n      phrases: ["Слово дня в \\(.applicationName)", "Покажи слово дня в \\(.applicationName)"]',
    );
    expect(shortcuts).toContain(
      'intent: OpenGameIntent(),\n      phrases: ["Відкрий гру в \\(.applicationName)", "Грати в \\(.applicationName)"]',
    );
    // «Слово дня» opens the app's start, the Feed; «Відкрити гру» the Game; each in the Edition built.
    expect(shortcuts).toContain(
      'extension WordOfTheDayIntent {\n  static let route = "?intent=wordOfTheDay&edition=uk"\n}',
    );
    expect(shortcuts).toContain(
      'extension OpenGameIntent {\n  static let route = "game?intent=openGame&edition=uk"\n}',
    );
  });

  it("titles the intents with the Edition's strings, which the Swift code names only by key", () => {
    const titles = {
      'appIntents.wordOfTheDay': 'Слово дня',
      'appIntents.openGame': 'Відкрити гру',
    };

    expect(appConfig(context).locales).toEqual({ uk: { ios: { 'Localizable.strings': titles } } });
    const swift = readFileSync(APP_INTENTS_SOURCE, 'utf8');
    for (const [key, title] of Object.entries(titles)) {
      expect(swift).toContain(`"${key}"`);
      expect(swift).not.toContain(title);
    }
  });

  it('refuses a phrase that does not name the app, which Siri would never answer', async () => {
    const broken = repoWithEdition(() => undefined, {
      change: (edition) => {
        editJson(edition.path('strings'), (strings) => {
          const appIntents = strings['appIntents'] as { openGame: { phrases: string[] } };
          appIntents.openGame.phrases = ['Грати в слова'];
          return strings;
        });
      },
    });

    await expect(prebuildIos(broken)).rejects.toThrow(
      /appIntents\.openGame\.phrases\.0: «Грати в слова» must name the app, SLOVO, exactly once/,
    );
  });

  it('accepts a notification sound of 30 seconds', () => {
    const longest = repoWithEdition(() => undefined, {
      change: (edition) => {
        writeFileSync(edition.asset('notification.wav'), wav(30));
      },
    });

    expect(() => appConfig(longest)).not.toThrow();
  });

  it('accepts a notification sound written as 24-bit WAVE_FORMAT_EXTENSIBLE PCM', () => {
    const extensible = repoWithEdition(() => undefined, {
      change: (edition) => {
        writeFileSync(
          edition.asset('notification.wav'),
          wav(1, { bitsPerSample: 24, extensible: 1 }),
        );
      },
    });

    expect(() => appConfig(extensible)).not.toThrow();
  });

  it('refuses a notification sound longer than 30 seconds', () => {
    const tooLong = repoWithEdition(() => undefined, {
      change: (edition) => {
        writeFileSync(edition.asset('notification.wav'), wav(31));
      },
    });

    expect(() => appConfig(tooLong)).toThrow(
      /editions\/uk\/assets\/notification\.wav.*longer than 30 seconds/s,
    );
  });

  it('refuses a notification sound in a format iOS does not play for notifications', () => {
    const mp3 = repoWithEdition((config) => {
      config['notificationSound'] = 'notification.mp3';
    });

    expect(() => appConfig(mp3)).toThrow(/notificationSound.*\.caf, \.wav, \.aiff/s);
  });

  it('refuses a sound file whose bytes are not the format its name says', () => {
    const disguised = repoWithEdition(() => undefined, {
      change: (edition) => {
        writeFileSync(
          edition.asset('notification.wav'),
          'ID3 an mp3 renamed to .wav, not a sound iOS plays',
        );
      },
    });

    expect(() => appConfig(disguised)).toThrow(/notification\.wav.*not a WAV, AIFF or CAF/s);
  });

  it('refuses a notification sound whose container differs from its extension', () => {
    const renamed = repoWithEdition(
      (config) => {
        config['notificationSound'] = 'notification.caf';
      },
      {
        change: (edition) => {
          writeFileSync(edition.asset('notification.caf'), wav(1));
        },
      },
    );

    expect(() => appConfig(renamed)).toThrow(/notification\.caf.*is a WAV file/s);
  });

  it('fails clearly when the named notification sound is missing', () => {
    const missing = repoWithEdition(() => undefined, {
      change: (edition) => {
        rmSync(edition.asset('notification.wav'));
      },
    });

    expect(() => appConfig(missing)).toThrow(
      /no notification sound.*editions\/uk\/assets\/notification\.wav/s,
    );
  });

  it("leaves Google's sign-in sheet out while the build has no Google client id", () => {
    vi.stubEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', '');

    const plugins = appConfig(context).plugins ?? [];

    expect(plugins.flat()).not.toContain('@react-native-google-signin/google-signin');
  });

  it("registers the URL scheme Google's sign-in sheet returns to, from the build's client id", () => {
    vi.stubEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', '123456789012-abc.apps.googleusercontent.com');

    expect(pluginOptions(appConfig(context), '@react-native-google-signin/google-signin')).toEqual({
      iosUrlScheme: 'com.googleusercontent.apps.123456789012-abc',
    });
  });

  it('refuses a Google client id that is not one for iOS', () => {
    vi.stubEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'com.googleusercontent.apps.123456789012-abc');

    expect(() => appConfig(context)).toThrow(
      /EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.*\.apps\.googleusercontent\.com/s,
    );
  });

  it.each(['testflight', 'production'])(
    'refuses a release build (%s) with no API address, naming the variable',
    (profile) => {
      vi.stubEnv('EAS_BUILD_PROFILE', profile);
      vi.stubEnv('EXPO_PUBLIC_SLOVO_API_URL', undefined);

      expect(() => appConfig(context)).toThrow(/EXPO_PUBLIC_SLOVO_API_URL is not set/);
    },
  );

  it('refuses a release build whose API address is not https', () => {
    vi.stubEnv('EAS_BUILD_PROFILE', 'testflight');
    vi.stubEnv('EXPO_PUBLIC_SLOVO_API_URL', 'http://api.example.com');

    expect(() => appConfig(context)).toThrow(/EXPO_PUBLIC_SLOVO_API_URL.*https:\/\//s);
  });

  it('builds a release with an https API address', () => {
    vi.stubEnv('EAS_BUILD_PROFILE', 'testflight');
    vi.stubEnv('EXPO_PUBLIC_SLOVO_API_URL', 'https://api.example.com');

    expect(appConfig(repoWithCertificate()).name).toBe(app.config.name);
  });

  it('refuses a release build of an app with the placeholder domain and no Team ID, naming the fields', () => {
    vi.stubEnv('EAS_BUILD_PROFILE', 'testflight');
    vi.stubEnv('EXPO_PUBLIC_SLOVO_API_URL', 'https://api.example.com');

    expect(() =>
      appConfig(
        repoWithEdition(() => undefined, {
          editApp: (config) => {
            config['domain'] = 'slovo.example';
            config['appleTeamId'] = '';
          },
        }),
      ),
    ).toThrow(/app\/app\.json › domain.*app\/app\.json › appleTeamId/s);
  });

  it("keeps the app's placeholder domain and empty Team ID in a development build", () => {
    vi.stubEnv('EAS_BUILD_PROFILE', 'development-simulator');

    const config = appConfig(
      repoWithEdition(() => undefined, {
        editApp: (app) => {
          app['domain'] = 'slovo.example';
          app['appleTeamId'] = '';
        },
      }),
    );

    expect(config.ios?.entitlements?.['com.apple.developer.associated-domains']).toEqual([
      'applinks:slovo.example',
    ]);
  });

  it.each([
    ['a development profile', 'development-simulator', 'http://localhost:8787'],
    ['a development profile with no address', 'development-simulator', undefined],
    ['Metro outside EAS', undefined, 'http://localhost:8788'],
  ])('keeps localhost for %s', (_, profile, address) => {
    vi.stubEnv('EAS_BUILD_PROFILE', profile);
    vi.stubEnv('EXPO_PUBLIC_SLOVO_API_URL', address);

    expect(appConfig(context).name).toBe(app.config.name);
  });

  describe('OTA updates (ADR 0062)', () => {
    it("checks the app's channel on launch for updates signed with SLOVO's certificate and made for its native code", () => {
      vi.stubEnv('EAS_BUILD_PROFILE', 'testflight');
      vi.stubEnv('EXPO_PUBLIC_SLOVO_API_URL', 'https://api.example.com');

      const config = appConfig(repoWithCertificate());

      expect(config.runtimeVersion).toEqual({ policy: 'fingerprint' });
      expect(config.updates).toEqual({
        enabled: true,
        url: 'https://u.expo.dev/e2401ef2-2a47-407e-b0ff-03706421b71c',
        requestHeaders: { 'expo-channel-name': 'uk' },
        checkAutomatically: 'ON_LOAD',
        fallbackToCacheTimeout: 3000,
        codeSigningCertificate: './certs/certificate.pem',
        codeSigningMetadata: { keyid: 'main', alg: 'rsa-v1_5-sha256' },
      });
    });

    it('takes the one channel from the AppConfig', () => {
      const channel = repoWithEdition(() => undefined, {
        editApp: (config) => {
          config['updateChannel'] = 'main';
        },
      });

      expect(appConfig(channel).updates?.requestHeaders).toEqual({ 'expo-channel-name': 'main' });
    });

    it('turns updates off in a development build', () => {
      vi.stubEnv('EAS_BUILD_PROFILE', 'development-simulator');

      expect(appConfig(context).updates?.enabled).toBe(false);
    });

    it('refuses a release build without the code-signing certificate', () => {
      vi.stubEnv('EAS_BUILD_PROFILE', 'testflight');
      vi.stubEnv('EXPO_PUBLIC_SLOVO_API_URL', 'https://api.example.com');

      expect(() =>
        appConfig(repoWithEdition(() => undefined, { editApp: withReleaseApp })),
      ).toThrow(/code-signing certificate.*certs\/certificate\.pem/s);
    });
  });
});
