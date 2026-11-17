import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

import { openAppConfig, REPO_DIR } from '@slovo/language-pack/edition';
import { describe, expect, it } from 'vitest';

const eas: unknown = JSON.parse(readFileSync(new URL('eas.json', import.meta.url), 'utf8'));
const manifest: unknown = JSON.parse(
  readFileSync(new URL('package.json', import.meta.url), 'utf8'),
);

const app = openAppConfig(REPO_DIR).config;
const { development, release } = app.buildProfiles.ios;
const stores = Object.entries(release);

function buildProfileNames(): string[] {
  if (typeof eas !== 'object' || eas === null || !('build' in eas)) return [];
  const { build } = eas;
  return typeof build === 'object' && build !== null ? Object.keys(build) : [];
}

describe('eas.json', () => {
  it('has exactly the build profiles the AppConfig names, one of each kind for iOS', () => {
    expect(buildProfileNames()).toEqual([development, release.beta, release.production]);
  });

  it('names no Edition in any build profile, so every build is the one app (ADR 0065)', () => {
    expect(JSON.stringify(eas)).not.toMatch(/SLOVO_EDITION/);
  });

  it('keeps the build number in EAS, so a TestFlight build can raise it, and the version in the app config (ADR 0044)', () => {
    expect(eas).toMatchObject({ cli: { appVersionSource: 'remote' } });
  });

  it.each(stores)(
    'builds the app for the store from the production environment, bound to the Update channel %s (ADR 0167)',
    (channel, profile) => {
      expect(eas).toMatchObject({
        build: {
          [profile]: {
            distribution: 'store',
            autoIncrement: true,
            environment: 'production',
            channel,
          },
        },
      });
    },
  );

  it('binds the development profile to no Update channel', () => {
    expect(eas).not.toHaveProperty(['build', development, 'channel']);
  });

  it("builds the pack from the Deployment's snapshot before bundling, with no snapshot file", () => {
    // EAS runs the hook after installing; build:pack fetches the records from
    // the backend at EXPO_PUBLIC_SLOVO_API_URL, which the environment holds.
    expect(manifest).toHaveProperty(
      ['scripts', 'eas-build-post-install'],
      'pnpm --dir ../.. build:pack',
    );
  });

  it('builds a development client for the simulator only in the development profile', () => {
    expect(eas).toMatchObject({
      build: {
        [development]: {
          developmentClient: true,
          distribution: 'internal',
          ios: { simulator: true },
        },
      },
    });
    for (const [, profile] of stores) {
      expect(eas).not.toHaveProperty(['build', profile, 'developmentClient']);
    }
  });

  it.each(stores)(
    "submits the %s build to the AppConfig's app in App Store Connect",
    (_channel, profile) => {
      const { appStoreConnectAppId } = app;
      const ascAppId = ['submit', profile, 'ios', 'ascAppId'];

      expect(eas).toHaveProperty(['submit', profile, 'ios']);
      // Until the AppConfig names its app, `eas submit` asks for it.
      if (appStoreConnectAppId === '') expect(eas).not.toHaveProperty(ascAppId);
      else expect(eas).toHaveProperty(ascAppId, appStoreConnectAppId);
    },
  );
});
