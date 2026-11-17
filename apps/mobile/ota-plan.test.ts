import { UpdateChannelSchema } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import { CHANNELS, otaPlan, type OtaInputs } from './ota-plan';

const PRODUCTION = 'https://api.example.org';
const STAGING = 'https://staging.example.org';

function inputs(overrides: Partial<OtaInputs>): OtaInputs {
  return {
    action: 'publish',
    channel: 'beta',
    rollout: '10',
    updateGroup: '',
    message: 'Fixes a typo',
    deploymentAddress: '',
    productionAddress: PRODUCTION,
    ...overrides,
  };
}

describe('otaPlan, the OTA workflow’s check before it publishes', () => {
  it('knows exactly the Update channels of the contracts', () => {
    expect(CHANNELS).toEqual(UpdateChannelSchema.options);
  });

  it('refuses an unknown channel', () => {
    expect(otaPlan(inputs({ channel: 'uk' }))).toEqual({
      ok: false,
      error: 'The channel is "uk": expected beta or production',
    });
  });

  it('refuses a production publish against any address but the production Deployment’s', () => {
    expect(otaPlan(inputs({ channel: 'production', deploymentAddress: STAGING }))).toEqual({
      ok: false,
      error: `The channel production takes only the production Deployment's address, not "${STAGING}"`,
    });
  });

  it('refuses a promotion against any address but the production Deployment’s', () => {
    const promote = { action: 'promote', updateGroup: 'abc-123', message: '' };
    expect(
      otaPlan(inputs({ ...promote, channel: 'production', deploymentAddress: STAGING })),
    ).toMatchObject({ ok: false });
  });

  it('builds against the production Deployment when no address is given', () => {
    expect(otaPlan(inputs({ channel: 'production' }))).toEqual({
      ok: true,
      plan: {
        action: 'publish',
        channel: 'production',
        address: PRODUCTION,
        production: true,
      },
    });
  });

  it('takes the production address with a trailing slash as the production Deployment', () => {
    expect(
      otaPlan(inputs({ channel: 'production', deploymentAddress: `${PRODUCTION}/` })),
    ).toMatchObject({ ok: true, plan: { address: PRODUCTION, production: true } });
  });

  it('lets a beta update be built against the Staging Deployment', () => {
    expect(otaPlan(inputs({ deploymentAddress: STAGING }))).toEqual({
      ok: true,
      plan: { action: 'publish', channel: 'beta', address: STAGING, production: false },
    });
  });

  it('promotes a beta update group to production', () => {
    expect(
      otaPlan(inputs({ action: 'promote', channel: 'production', updateGroup: 'abc-123' })),
    ).toEqual({
      ok: true,
      plan: { action: 'promote', channel: 'production', address: PRODUCTION, production: true },
    });
  });

  it('refuses a promotion to beta, since a promotion goes from beta to production', () => {
    expect(otaPlan(inputs({ action: 'promote', updateGroup: 'abc-123' }))).toEqual({
      ok: false,
      error:
        'A promotion republishes a beta update group to production: choose the channel production',
    });
  });

  it('refuses a promotion or a widening without an update group', () => {
    expect(otaPlan(inputs({ action: 'promote', channel: 'production' }))).toMatchObject({
      ok: false,
    });
    expect(otaPlan(inputs({ action: 'widen' }))).toMatchObject({ ok: false });
  });

  it('refuses an unknown action', () => {
    expect(otaPlan(inputs({ action: 'rollback' }))).toEqual({
      ok: false,
      error: 'The action is "rollback": expected publish, widen or promote',
    });
  });

  it('refuses a Rollout share that is not a whole number from 1 to 100', () => {
    for (const rollout of ['0', '101', '12.5', 'ten', '']) {
      expect(otaPlan(inputs({ rollout }))).toEqual({
        ok: false,
        error: `The Rollout share is "${rollout}": expected a whole number from 1 to 100`,
      });
    }
  });

  it('refuses an update group that is not an update group id', () => {
    expect(otaPlan(inputs({ action: 'widen', updateGroup: 'abc; rm -rf /' }))).toMatchObject({
      ok: false,
    });
  });

  it('refuses a new update without a message', () => {
    expect(otaPlan(inputs({ message: '' }))).toEqual({
      ok: false,
      error: 'A new update needs a message',
    });
  });

  it('refuses an address that is not https://', () => {
    expect(otaPlan(inputs({ deploymentAddress: 'http://localhost:8787' }))).toMatchObject({
      ok: false,
    });
  });

  it('refuses to run when the production Deployment’s address is unknown', () => {
    expect(otaPlan(inputs({ productionAddress: '' }))).toMatchObject({ ok: false });
  });
});
