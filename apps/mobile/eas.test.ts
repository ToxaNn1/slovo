import { readFileSync } from 'node:fs';

import { EDITIONS_DIR, openAppConfig, openEdition, REPO_DIR } from '@slovo/language-pack/edition';
import { describe, expect, it } from 'vitest';

const eas: unknown = JSON.parse(readFileSync(new URL('eas.json', import.meta.url), 'utf8'));

const ukrainian = openEdition(EDITIONS_DIR, 'uk');
const app = openAppConfig(REPO_DIR).config;
const { development, release } = app.buildProfiles.ios;

function buildProfileNames(): string[] {
  if (typeof eas !== 'object' || eas === null || !('build' in eas)) return [];
  const { build } = eas;
  return typeof build === 'object' && build !== null ? Object.keys(build) : [];
}

describe('eas.json', () => {
  it('has the build profiles the AppConfig names, one of each kind for iOS, over the simulator base', () => {
    expect(buildProfileNames()).toEqual(['development-simulator', development, release]);
  });

  it('keeps the build number in EAS, so a TestFlight build can raise it, and the version in the app config (ADR 0044)', () => {
    expect(eas).toMatchObject({ cli: { appVersionSource: 'remote' } });
  });

  it("builds the app for the store from the production environment, bound to the AppConfig's one channel", () => {
    expect(eas).toMatchObject({
      build: {
        [release]: {
          distribution: 'store',
          autoIncrement: true,
          environment: 'production',
          channel: app.updateChannel,
          env: { SLOVO_EDITION: ukrainian.config.id },
        },
      },
    });
  });

  it('builds a development client for the simulator only in the development profiles', () => {
    expect(eas).toMatchObject({
      build: {
        'development-simulator': {
          developmentClient: true,
          distribution: 'internal',
          ios: { simulator: true },
        },
        [development]: {
          extends: 'development-simulator',
          env: { SLOVO_EDITION: ukrainian.config.id },
        },
      },
    });
  });

  it("submits the TestFlight build to the AppConfig's app in App Store Connect", () => {
    const { appStoreConnectAppId } = app;
    const ascAppId = ['submit', release, 'ios', 'ascAppId'];

    expect(eas).toHaveProperty(['submit', release, 'ios']);
    // Until the AppConfig names its app, `eas submit` asks for it.
    if (appStoreConnectAppId === '') expect(eas).not.toHaveProperty(ascAppId);
    else expect(eas).toHaveProperty(ascAppId, appStoreConnectAppId);
  });
});
