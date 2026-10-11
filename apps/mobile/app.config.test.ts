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

afterEach(() => {
  vi.unstubAllEnvs();
});

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
});
