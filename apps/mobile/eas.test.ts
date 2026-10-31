import { readFileSync } from 'node:fs';

import { EDITIONS_DIR, openEdition } from '@slovo/language-pack/edition';
import { describe, expect, it } from 'vitest';

const eas: unknown = JSON.parse(readFileSync(new URL('eas.json', import.meta.url), 'utf8'));

const ukrainian = openEdition(EDITIONS_DIR, 'uk');

function buildProfileNames(): string[] {
  if (typeof eas !== 'object' || eas === null || !('build' in eas)) return [];
  const { build } = eas;
  return typeof build === 'object' && build !== null ? Object.keys(build) : [];
}

describe('eas.json', () => {
  it('has the simulator development profiles and the TestFlight profile of the Ukrainian Edition', () => {
    expect(buildProfileNames()).toEqual([
      'development-simulator',
      'development-simulator-uk',
      'testflight-uk',
    ]);
  });

  it('keeps the build number in EAS, so a TestFlight build can raise it, and the version in the app config (ADR 0044)', () => {
    expect(eas).toMatchObject({ cli: { appVersionSource: 'remote' } });
  });

  it("builds the Ukrainian Edition for the store from the production environment, bound to the Edition's channel", () => {
    expect(eas).toMatchObject({
      build: {
        'testflight-uk': {
          distribution: 'store',
          autoIncrement: true,
          environment: 'production',
          channel: ukrainian.config.updateChannel,
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
        'development-simulator-uk': {
          extends: 'development-simulator',
          env: { SLOVO_EDITION: ukrainian.config.id },
        },
      },
    });
  });

  it("submits the TestFlight build to the Edition's app in App Store Connect", () => {
    const { appStoreConnectAppId } = ukrainian.config;
    const ascAppId = ['submit', 'testflight-uk', 'ios', 'ascAppId'];

    expect(eas).toHaveProperty(['submit', 'testflight-uk', 'ios']);
    // Until the Edition names its app, `eas submit` asks for it.
    if (appStoreConnectAppId === '') expect(eas).not.toHaveProperty(ascAppId);
    else expect(eas).toHaveProperty(ascAppId, appStoreConnectAppId);
  });
});
