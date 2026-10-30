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
  EDITIONS_DIR,
  FONTS_DIR,
  openEdition,
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

const temporaryRepos: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const repo of temporaryRepos.splice(0)) rmSync(repo, { recursive: true, force: true });
});

/**
 * A throwaway repo layout (`apps/mobile` next to `editions/uk`) holding a copy
 * of the Ukrainian Edition with its config changed by `edit`. The icon is
 * copied unless `withIcon` is false; `change` may then edit the copy.
 */
function repoWithEdition(
  edit: (config: Record<string, unknown>) => void,
  {
    withIcon = true,
    change = () => undefined,
  }: { withIcon?: boolean; change?: (edition: EditionFolder) => void } = {},
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
  if (!withIcon) rmSync(copy.path('icon'));
  change(copy);
  return { ...context, projectRoot };
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
  it('fails clearly when no Edition is selected', () => {
    vi.stubEnv('SLOVO_EDITION', undefined);

    expect(() => appConfig(context)).toThrow(/SLOVO_EDITION is not set.*Known Editions: uk/s);
  });

  it('fails clearly when the selected Edition does not exist', () => {
    vi.stubEnv('SLOVO_EDITION', 'xx');

    expect(() => appConfig(context)).toThrow(/Unknown Edition "xx".*Known Editions: uk/s);
  });

  it('rejects an Edition id that is not a plain folder name', () => {
    vi.stubEnv('SLOVO_EDITION', '../uk');

    expect(() => appConfig(context)).toThrow(/Unknown Edition "\.\.\/uk"/);
  });

  it('takes the name, bundle id, icon and locale from the selected Edition', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

    const config = appConfig(context);

    expect(config.name).toBe('SLOVO');
    expect(config.ios?.bundleIdentifier).toBe('app.slovo.uk');
    expect(config.icon).toMatch(/editions\/uk\/assets\/icon\.png$/);
    expect(config.ios?.infoPlist?.['CFBundleDevelopmentRegion']).toBe('uk');
    expect(config.extra?.['edition']).toMatchObject({ id: 'uk' });
  });

  it('turns on the React Compiler (ADR 0059)', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

    expect(appConfig(context).experiments?.reactCompiler).toBe(true);
  });

  it('names the field when the Edition config is invalid', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const broken = repoWithEdition((config) => {
      delete config['locale'];
      config['bundleId'] = 'NotReverseDns';
    });

    expect(() => appConfig(broken)).toThrow(
      /editions\/uk is not valid.*edition\.json › locale.*edition\.json › bundleId/s,
    );
  });

  it('rejects a config whose id differs from its folder name', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const mismatched = repoWithEdition((config) => {
      config['id'] = 'xx';
    });

    expect(() => appConfig(mismatched)).toThrow(/id "xx".*folder "uk"/s);
  });

  it('fails clearly when the Edition has no icon', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const withoutIcon = repoWithEdition(() => undefined, { withIcon: false });

    expect(() => appConfig(withoutIcon)).toThrow(/no icon.*editions\/uk\/assets\/icon\.png/s);
  });

  it('builds a config from a valid Edition copied elsewhere', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

    expect(appConfig(repoWithEdition(() => undefined)).ios?.bundleIdentifier).toBe('app.slovo.uk');
  });

  it("embeds the Core's fonts and the Edition's own in the native app", () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

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
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const repo = repoWithEdition(() => undefined, {
      change: (edition) => {
        // Its Word of the Day font is then one of the Core's, which it may not name.
        rmSync(join(edition.dir, FONTS_DIR), { recursive: true });
      },
    });

    expect(() => appConfig(repo)).toThrow(/not among the Edition's fonts: Kurale-Regular\.ttf/);
  });

  it('embeds the Word of the Day font and passes its family on to the app', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

    const config = appConfig(context);
    const { fonts } = pluginOptions(config, 'expo-font') as { fonts: string[] };

    expect(fonts).toContain('../../editions/uk/assets/fonts/Kurale-Regular.ttf');
    expect(config.extra?.['edition']).toEqual({ id: 'uk', wordOfTheDayFontFamily: 'Kurale' });
  });

  it('passes on the family of whichever font the Edition names for the Word of the Day', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
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
    vi.stubEnv('SLOVO_EDITION', 'uk');
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
    vi.stubEnv('SLOVO_EDITION', 'uk');
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
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const withoutFont = repoWithEdition(() => undefined, {
      change: (edition) => {
        rmSync(join(edition.dir, FONTS_DIR, 'Kurale-Regular.ttf'));
      },
    });

    expect(() => appConfig(withoutFont)).toThrow(/wordOfTheDayFont.*Kurale-Regular\.ttf/);
  });

  it('fails clearly when the Word of the Day font is not a font', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const notAFont = repoWithEdition(() => undefined, {
      change: (edition) => {
        writeFileSync(join(edition.dir, FONTS_DIR, 'Kurale-Regular.ttf'), 'not a font');
      },
    });

    expect(() => appConfig(notAFont)).toThrow(/Kurale-Regular\.ttf has no family name/);
  });

  it("takes the splash from the Edition's Decor in both Themes", () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

    expect(pluginOptions(appConfig(context), 'expo-splash-screen')).toEqual({
      image: '../../editions/uk/decor/splash-light.png',
      backgroundColor: '#F5EEE2',
      imageWidth: 72,
      dark: { image: '../../editions/uk/decor/splash-dark.png', backgroundColor: '#15110E' },
    });
  });

  it('falls back to the plain Core splash when the Edition has no splash Decor', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const withoutSplash = repoWithEdition(() => undefined, {
      change: (edition) => {
        rmSync(edition.path('splash'));
      },
    });

    expect(pluginOptions(appConfig(withoutSplash), 'expo-splash-screen')).toEqual({
      backgroundColor: '#F4F4F2',
      dark: { backgroundColor: '#111111' },
    });
  });

  it('names the field when the splash Decor is invalid', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const broken = repoWithEdition(() => undefined, {
      change: (edition) => {
        editJson(edition.path('splash'), (splash) => ({
          ...splash,
          dark: { image: 'splash-dark.png', backgroundColor: 'black' },
        }));
      },
    });

    expect(() => appConfig(broken)).toThrow(
      /editions\/uk is not valid.*decor\/splash\.json › dark\.backgroundColor/s,
    );
  });

  it('fails clearly when a splash image is missing', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const withoutImage = repoWithEdition(() => undefined, {
      change: (edition) => {
        rmSync(edition.decorFile('splash-dark.png'));
      },
    });

    expect(() => appConfig(withoutImage)).toThrow(
      /splash image.*editions\/uk\/decor\/splash-dark\.png/s,
    );
  });

  it('bundles the notification sound of the Edition through expo-notifications', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

    expect(pluginOptions(appConfig(context), 'expo-notifications')).toEqual({
      sounds: ['../../editions/uk/assets/notification.wav'],
    });
  });

  it('bundles no sound when the Edition has none', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const withoutSound = repoWithEdition((config) => {
      delete config['notificationSound'];
    });

    expect(pluginOptions(appConfig(withoutSound), 'expo-notifications')).toEqual({ sounds: [] });
  });

  it('shares the App Group derived from the bundle id between the app and the widget', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

    expect(appConfig(context).ios?.entitlements?.['com.apple.security.application-groups']).toEqual(
      ['group.app.slovo.uk'],
    );
  });

  it("claims the Edition's link domain for Collection Links (ADR 0058)", () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const otherDomain = repoWithEdition((config) => {
      config['linkDomain'] = 'links.slovo.test';
    });

    expect(
      appConfig(otherDomain).ios?.entitlements?.['com.apple.developer.associated-domains'],
    ).toEqual(['applinks:links.slovo.test']);
  });

  it('adds the widget extension from apps/widget', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

    expect(pluginOptions(appConfig(context), '@bacons/apple-targets')).toEqual({
      root: '..',
      match: 'widget',
    });
  });

  it('bundles into the widget extension only the fonts of the families it draws with', async () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
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
    vi.stubEnv('SLOVO_EDITION', 'uk');
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
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const broken = repoWithEdition(() => undefined, {
      change: (edition) => {
        editJson(edition.path('widgetSnapshotExample'), (example) => ({ ...example, format: 0 }));
      },
    });

    expect(() => appConfig(broken)).toThrow(/widget-snapshot\.example\.json › format/);
  });

  it("names the field when the widget's strings are missing", () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const broken = repoWithEdition(() => undefined, {
      change: (edition) => {
        editJson(edition.path('strings'), (strings) => ({ ...strings, widget: {} }));
      },
    });

    expect(() => appConfig(broken)).toThrow(/strings\.json › widget\.galleryName/);
  });

  it("names the field when the widget palette's text is too faint for its background", () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const faint = repoWithEdition((config) => {
      config['widgetPalette'] = {
        parchment: { background: '#F3E9D2', text: '#C8BBA0' },
        blue: { background: '#1F3A5F', text: '#F3E9D2' },
      };
    });

    expect(() => appConfig(faint)).toThrow(/widgetPalette\.parchment\.text/);
  });

  it('registers the native time picker', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

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

  it("gives the Spotlight module the Edition's scheme, so a tapped result opens as its link", () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

    expect(appConfig(context).ios?.infoPlist?.['SlovoLinkScheme']).toBe('slovo-uk');
  });

  it('compiles the App Intents and their App Shortcuts into the app, however often it is prebuilt', async () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

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

  it("gives Siri the Edition's phrases, each naming the app as Siri hears it, and each intent its route", async () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

    const iosDir = await prebuildIos(repoWithEdition(() => undefined));

    const shortcuts = readFileSync(join(iosDir, 'SLOVO/SlovoAppShortcuts.swift'), 'utf8');
    expect(shortcuts).toContain(
      'intent: WordOfTheDayIntent(),\n      phrases: ["Слово дня в \\(.applicationName)", "Покажи слово дня в \\(.applicationName)"]',
    );
    expect(shortcuts).toContain(
      'intent: OpenGameIntent(),\n      phrases: ["Відкрий гру в \\(.applicationName)", "Грати в \\(.applicationName)"]',
    );
    // «Слово дня» opens the app's start, the Feed; «Відкрити гру» the Game.
    expect(shortcuts).toContain(
      'extension WordOfTheDayIntent {\n  static let route = "?intent=wordOfTheDay"\n}',
    );
    expect(shortcuts).toContain(
      'extension OpenGameIntent {\n  static let route = "game?intent=openGame"\n}',
    );
  });

  it("titles the intents with the Edition's strings, which the Swift code names only by key", () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

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
    vi.stubEnv('SLOVO_EDITION', 'uk');
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
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const longest = repoWithEdition(() => undefined, {
      change: (edition) => {
        writeFileSync(edition.asset('notification.wav'), wav(30));
      },
    });

    expect(() => appConfig(longest)).not.toThrow();
  });

  it('accepts a notification sound written as 24-bit WAVE_FORMAT_EXTENSIBLE PCM', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
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
    vi.stubEnv('SLOVO_EDITION', 'uk');
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
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const mp3 = repoWithEdition((config) => {
      config['notificationSound'] = 'notification.mp3';
    });

    expect(() => appConfig(mp3)).toThrow(/notificationSound.*\.caf, \.wav, \.aiff/s);
  });

  it('refuses a sound file whose bytes are not the format its name says', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
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
    vi.stubEnv('SLOVO_EDITION', 'uk');
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
    vi.stubEnv('SLOVO_EDITION', 'uk');
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
    vi.stubEnv('SLOVO_EDITION', 'uk');
    vi.stubEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', '');

    const plugins = appConfig(context).plugins ?? [];

    expect(plugins.flat()).not.toContain('@react-native-google-signin/google-signin');
  });

  it("registers the URL scheme Google's sign-in sheet returns to, from the build's client id", () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    vi.stubEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', '123456789012-abc.apps.googleusercontent.com');

    expect(pluginOptions(appConfig(context), '@react-native-google-signin/google-signin')).toEqual({
      iosUrlScheme: 'com.googleusercontent.apps.123456789012-abc',
    });
  });

  it('refuses a Google client id that is not one for iOS', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    vi.stubEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'com.googleusercontent.apps.123456789012-abc');

    expect(() => appConfig(context)).toThrow(
      /EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.*\.apps\.googleusercontent\.com/s,
    );
  });
});
