import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ConfigContext, ExpoConfig } from 'expo/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import appConfig from './app.config';

const context: ConfigContext = {
  projectRoot: fileURLToPath(new URL('.', import.meta.url)),
  staticConfigPath: null,
  packageJsonPath: null,
  config: {},
};

const ukrainianEditionDir = fileURLToPath(new URL('../../editions/uk/', import.meta.url));

const temporaryRepos: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const repo of temporaryRepos.splice(0)) rmSync(repo, { recursive: true, force: true });
});

/**
 * A throwaway repo layout (`apps/mobile` next to `editions/uk`) holding a copy
 * of the Ukrainian Edition's config, changed by `edit`, with its assets and
 * Decor. The icon is copied unless `withIcon` is false; `change` may then edit
 * the copied Edition folder.
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
  for (const folder of ['assets', 'decor']) {
    cpSync(join(ukrainianEditionDir, folder), join(editionDir, folder), { recursive: true });
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
});
