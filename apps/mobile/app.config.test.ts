import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ConfigContext, ExpoConfig } from 'expo/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import appConfig from './app.config';
import { wav } from './wav-builder';

const context: ConfigContext = {
  projectRoot: fileURLToPath(new URL('.', import.meta.url)),
  staticConfigPath: null,
  packageJsonPath: null,
  config: {},
};

const ukrainianEditionDir = fileURLToPath(new URL('../../editions/uk/', import.meta.url));

const temporaryRepos: string[] = [];

const WIDGET_EXAMPLE = 'widget-snapshot.example.json';

afterEach(() => {
  vi.unstubAllEnvs();
  for (const repo of temporaryRepos.splice(0)) rmSync(repo, { recursive: true, force: true });
});

/**
 * A throwaway repo layout (`apps/mobile` next to `editions/uk`) holding a copy
 * of the Ukrainian Edition's config, changed by `edit`, with its assets,
 * Decor, strings, tokens and example Widget Snapshot. The icon is copied
 * unless `withIcon` is false; `change` may then edit the copied Edition folder.
 */
function repoWithEdition(
  edit: (config: Record<string, unknown>) => void,
  {
    withIcon = true,
    change = () => undefined,
  }: { withIcon?: boolean; change?: (editionDir: string) => void } = {},
): ConfigContext {
  const repo = mkdtempSync(join(tmpdir(), 'slovo-app-config-'));
  temporaryRepos.push(repo);
  const projectRoot = join(repo, 'apps/mobile');
  const editionDir = join(repo, 'editions/uk');
  mkdirSync(projectRoot, { recursive: true });
  mkdirSync(editionDir, { recursive: true });
  const config = JSON.parse(
    readFileSync(join(ukrainianEditionDir, 'edition.json'), 'utf8'),
  ) as Record<string, unknown>;
  edit(config);
  writeFileSync(join(editionDir, 'edition.json'), JSON.stringify(config));
  for (const kept of ['assets', 'decor', 'strings.json', 'tokens.json', WIDGET_EXAMPLE]) {
    cpSync(join(ukrainianEditionDir, kept), join(editionDir, kept), { recursive: true });
  }
  if (!withIcon) rmSync(join(editionDir, 'assets/icon.png'));
  change(editionDir);
  return { ...context, projectRoot };
}

/** The options the config passes to the named config plugin. */
function pluginOptions(config: ExpoConfig, name: string): unknown {
  const plugin = config.plugins?.find(
    (entry) => (Array.isArray(entry) ? entry[0] : entry) === name,
  );
  return Array.isArray(plugin) ? plugin[1] : undefined;
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
    expect(config.extra?.['edition']).toEqual({ id: 'uk' });
  });

  it('names the field when the Edition config is invalid', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const broken = repoWithEdition((config) => {
      delete config['locale'];
      config['bundleId'] = 'NotReverseDns';
    });

    expect(() => appConfig(broken)).toThrow(
      /editions\/uk\/edition\.json is not a valid Edition config.*locale.*bundleId/s,
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

  it('embeds every font file of the Edition in the native app', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

    const { fonts } = pluginOptions(appConfig(context), 'expo-font') as { fonts: string[] };

    expect(fonts).toEqual(
      [
        'Literata-Italic.ttf',
        'Literata-Medium.ttf',
        'Literata-Regular.ttf',
        'Literata-SemiBold.ttf',
        'Manrope-Bold.ttf',
        'Manrope-Medium.ttf',
        'Manrope-Regular.ttf',
        'Manrope-SemiBold.ttf',
      ].map((file) => `../../editions/uk/assets/fonts/${file}`),
    );
  });

  it('embeds no fonts when the Edition brings none', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const withoutFonts = repoWithEdition(() => undefined, {
      change: (editionDir) => {
        rmSync(join(editionDir, 'assets/fonts'), { recursive: true });
      },
    });

    expect(pluginOptions(appConfig(withoutFonts), 'expo-font')).toEqual({ fonts: [] });
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
      change: (editionDir) => {
        rmSync(join(editionDir, 'decor/splash.json'));
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
      change: (editionDir) => {
        const file = join(editionDir, 'decor/splash.json');
        const splash = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
        splash['dark'] = { image: 'splash-dark.png', backgroundColor: 'black' };
        writeFileSync(file, JSON.stringify(splash));
      },
    });

    expect(() => appConfig(broken)).toThrow(
      /editions\/uk\/decor\/splash\.json is not a valid splash Decor.*dark\.backgroundColor/s,
    );
  });

  it('fails clearly when a splash image is missing', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const withoutImage = repoWithEdition(() => undefined, {
      change: (editionDir) => {
        rmSync(join(editionDir, 'decor/splash-dark.png'));
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

    expect(appConfig(context).ios?.entitlements).toEqual({
      'com.apple.security.application-groups': ['group.app.slovo.uk'],
    });
  });

  it('adds the widget extension from apps/widget', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

    expect(pluginOptions(appConfig(context), '@bacons/apple-targets')).toEqual({
      root: '..',
      match: 'widget',
    });
  });

  it('fails clearly when the Edition has no example Widget Snapshot for the gallery', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const withoutExample = repoWithEdition(() => undefined, {
      change: (editionDir) => {
        rmSync(join(editionDir, WIDGET_EXAMPLE));
      },
    });

    expect(() => appConfig(withoutExample)).toThrow(
      /no example Widget Snapshot.*editions\/uk\/widget-snapshot\.example\.json/s,
    );
  });

  it('names the field when the example Widget Snapshot is invalid', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const broken = repoWithEdition(() => undefined, {
      change: (editionDir) => {
        const file = join(editionDir, WIDGET_EXAMPLE);
        const example = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
        writeFileSync(file, JSON.stringify({ ...example, format: 0 }));
      },
    });

    expect(() => appConfig(broken)).toThrow(
      /widget-snapshot\.example\.json is not a valid Widget Snapshot.*format/s,
    );
  });

  it("names the field when the widget's strings are missing", () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const broken = repoWithEdition(() => undefined, {
      change: (editionDir) => {
        const file = join(editionDir, 'strings.json');
        const strings = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
        writeFileSync(file, JSON.stringify({ ...strings, widget: {} }));
      },
    });

    expect(() => appConfig(broken)).toThrow(
      /strings\.json is not a valid Edition strings.*widget\.galleryName/s,
    );
  });

  it('registers the native time picker', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');

    expect(appConfig(context).plugins).toContain('@react-native-community/datetimepicker');
  });

  it('accepts a notification sound of 30 seconds', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const longest = repoWithEdition(() => undefined, {
      change: (editionDir) => {
        writeFileSync(join(editionDir, 'assets/notification.wav'), wav(30));
      },
    });

    expect(() => appConfig(longest)).not.toThrow();
  });

  it('accepts a notification sound written as 24-bit WAVE_FORMAT_EXTENSIBLE PCM', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const extensible = repoWithEdition(() => undefined, {
      change: (editionDir) => {
        writeFileSync(
          join(editionDir, 'assets/notification.wav'),
          wav(1, { bitsPerSample: 24, extensible: 1 }),
        );
      },
    });

    expect(() => appConfig(extensible)).not.toThrow();
  });

  it('refuses a notification sound longer than 30 seconds', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const tooLong = repoWithEdition(() => undefined, {
      change: (editionDir) => {
        writeFileSync(join(editionDir, 'assets/notification.wav'), wav(31));
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
      change: (editionDir) => {
        writeFileSync(
          join(editionDir, 'assets/notification.wav'),
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
        change: (editionDir) => {
          writeFileSync(join(editionDir, 'assets/notification.caf'), wav(1));
        },
      },
    );

    expect(() => appConfig(renamed)).toThrow(/notification\.caf.*is a WAV file/s);
  });

  it('fails clearly when the named notification sound is missing', () => {
    vi.stubEnv('SLOVO_EDITION', 'uk');
    const missing = repoWithEdition(() => undefined, {
      change: (editionDir) => {
        rmSync(join(editionDir, 'assets/notification.wav'));
      },
    });

    expect(() => appConfig(missing)).toThrow(
      /no notification sound.*editions\/uk\/assets\/notification\.wav/s,
    );
  });
});
