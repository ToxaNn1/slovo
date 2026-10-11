import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ConfigContext } from 'expo/config';
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
 * of the Ukrainian Edition's config, changed by `edit`. The icon is copied
 * unless `withIcon` is false.
 */
function repoWithEdition(
  edit: (config: Record<string, unknown>) => void,
  { withIcon = true }: { withIcon?: boolean } = {},
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
  if (withIcon)
    cpSync(join(ukrainianEditionDir, 'assets'), join(editionDir, 'assets'), { recursive: true });
  return { ...context, projectRoot };
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
});
