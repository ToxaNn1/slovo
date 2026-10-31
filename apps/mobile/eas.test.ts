import { readFileSync } from 'node:fs';

import { openAppConfig, REPO_DIR } from '@slovo/language-pack/edition';
import { describe, expect, it } from 'vitest';

const eas: unknown = JSON.parse(readFileSync(new URL('eas.json', import.meta.url), 'utf8'));

const app = openAppConfig(REPO_DIR).config;
const { development, release } = app.buildProfiles.ios;

function buildProfileNames(): string[] {
  if (typeof eas !== 'object' || eas === null || !('build' in eas)) return [];
  const { build } = eas;
  return typeof build === 'object' && build !== null ? Object.keys(build) : [];
}

describe('eas.json', () => {
  it('has exactly the build profiles the AppConfig names, one of each kind for iOS', () => {
    expect(buildProfileNames()).toEqual([development, release]);
  });

  it('names no Edition in any build profile, so every build is the one app (ADR 0065)', () => {
    expect(JSON.stringify(eas)).not.toMatch(/SLOVO_EDITION/);
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
        },
      },
    });
  });

  it('builds a development client for the simulator only in the development profile', () => {
    expect(eas).toMatchObject({
      build: {
        [development]: { developmentClient: true, distribution: 'internal', ios: { simulator: true } },
      },
    });
    expect(eas).not.toHaveProperty(['build', release, 'developmentClient']);
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
