import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { APP_CONFIG_FILE, AppConfigError, REPO_DIR, openAppConfig } from './edition-folder';

const workDirs: string[] = [];

afterEach(() => {
  for (const dir of workDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

type Json = Record<string, unknown>;

/** A copy of the repo's AppConfig in a temporary repo, changed as given. */
function repoWith(change: (config: Json) => Json = (config) => config): string {
  const repoDir = mkdtempSync(join(tmpdir(), 'slovo-repo-'));
  workDirs.push(repoDir);
  cpSync(join(REPO_DIR, 'app'), join(repoDir, 'app'), { recursive: true });
  const file = join(repoDir, APP_CONFIG_FILE);
  writeFileSync(file, JSON.stringify(change(JSON.parse(readFileSync(file, 'utf8')) as Json)));
  return repoDir;
}

function failureOf(open: () => unknown): AppConfigError | undefined {
  try {
    open();
  } catch (error) {
    if (error instanceof AppConfigError) return error;
    throw error;
  }
  return undefined;
}

const fieldsOf = (failure: AppConfigError | undefined) =>
  failure?.errors.map(({ file, field }) => `${file} › ${field ?? ''}`);

describe('the AppConfig', () => {
  it('parses for the app that holds the UA Edition, with the App Group from the bundle id', () => {
    const app = openAppConfig(REPO_DIR);

    expect(app.config).toMatchObject({
      bundleId: 'app.slovo.uk',
      appGroup: 'group.app.slovo.uk',
      updateChannel: 'uk',
      buildProfiles: { ios: { development: 'development-simulator-uk', release: 'testflight-uk' } },
    });
    expect(app.path('icon')).toBe(join(REPO_DIR, 'editions/uk/assets/icon.png'));
    expect(app.splash().light.image).toMatch(/\.png$/);
  });

  it('names every wrong field, and refuses an authored App Group', () => {
    const repoDir = repoWith(({ scheme: _scheme, ...config }) => ({
      ...config,
      bundleId: 'NotReverseDns',
      appGroup: 'group.app.slovo.uk',
    }));

    expect(fieldsOf(failureOf(() => openAppConfig(repoDir)))).toEqual([
      'app/app.json › scheme',
      'app/app.json › bundleId',
      'app/app.json › appGroup',
    ]);
  });

  it('keeps the placeholder domain and an empty Team ID for a development build', () => {
    expect(openAppConfig(repoWith()).config).toMatchObject({
      domain: 'slovo.example',
      appleTeamId: '',
    });
  });

  it('refuses the placeholder domain and an empty Team ID for a release build', () => {
    const failure = failureOf(() => openAppConfig(repoWith(), { build: 'release' }));

    expect(fieldsOf(failure)).toEqual(['app/app.json › domain', 'app/app.json › appleTeamId']);
    expect(failure?.message).toMatch(/slovo\.example.*placeholder/s);
  });

  it.each(['slovo.test', 'links.slovo.invalid', 'example.com', 'slovo.example.org'])(
    'refuses %s, a domain reserved for examples, for a release build',
    (domain) => {
      const repoDir = repoWith((config) => ({ ...config, domain, appleTeamId: 'A1B2C3D4E5' }));

      expect(fieldsOf(failureOf(() => openAppConfig(repoDir, { build: 'release' })))).toEqual([
        'app/app.json › domain',
      ]);
    },
  );

  it('opens with a real domain and Team ID for a release build', () => {
    const repoDir = repoWith((config) => ({
      ...config,
      domain: 'slovo.app',
      appleTeamId: 'A1B2C3D4E5',
    }));

    expect(openAppConfig(repoDir, { build: 'release' }).config).toMatchObject({
      domain: 'slovo.app',
      appleTeamId: 'A1B2C3D4E5',
    });
  });

  it.each([
    ['appleTeamId', 'a1b2c3d4e5'],
    ['appStoreConnectAppId', 'app-1'],
    ['icon', '../icon.png'],
  ])('refuses %s "%s"', (field, value) => {
    const repoDir = repoWith((config) => ({ ...config, [field]: value }));

    expect(fieldsOf(failureOf(() => openAppConfig(repoDir)))).toEqual([`app/app.json › ${field}`]);
  });

  it('reports a missing AppConfig', () => {
    const repoDir = mkdtempSync(join(tmpdir(), 'slovo-repo-'));
    workDirs.push(repoDir);

    expect(failureOf(() => openAppConfig(repoDir))?.errors).toEqual([
      { file: APP_CONFIG_FILE, message: 'File not found' },
    ]);
  });
});
