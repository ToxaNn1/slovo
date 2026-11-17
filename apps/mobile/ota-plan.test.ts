import { describe, expect, it } from 'vitest';

import { checkInputs, otaPlan, type OtaInputs, type OtaPublish } from './ota-plan';

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
    ...overrides,
  };
}

/** The checked inputs of a new update, or a failure if the inputs are refused. */
function publish(overrides: Partial<OtaInputs>): OtaPublish {
  const check = checkInputs(inputs(overrides));
  if (!check.ok || check.request.action !== 'publish') throw new Error('expected a new update');
  return check.request;
}

describe('checkInputs, the OTA workflow’s check before any EAS call', () => {
  it('refuses an unknown channel', () => {
    expect(checkInputs(inputs({ channel: 'uk' }))).toEqual({
      ok: false,
      error: 'The channel is "uk": expected beta or production',
    });
  });

  it('refuses an unknown action', () => {
    expect(checkInputs(inputs({ action: 'rollback' }))).toEqual({
      ok: false,
      error: 'The action is "rollback": expected publish, widen or promote',
    });
  });

  it('refuses a Rollout share that is not a whole number from 1 to 100', () => {
    for (const rollout of ['0', '101', '12.5', 'ten', '']) {
      expect(checkInputs(inputs({ rollout }))).toEqual({
        ok: false,
        error: `The Rollout share is "${rollout}": expected a whole number from 1 to 100`,
      });
    }
  });

  it('refuses a new update without a message', () => {
    expect(checkInputs(inputs({ message: '' }))).toEqual({
      ok: false,
      error: 'A new update needs a message',
    });
  });

  it('refuses a new update with an update group', () => {
    expect(checkInputs(inputs({ updateGroup: 'abc-123' }))).toMatchObject({ ok: false });
  });

  it('refuses a promotion or a widening without an update group', () => {
    expect(checkInputs(inputs({ action: 'promote', channel: 'production' }))).toMatchObject({
      ok: false,
    });
    expect(checkInputs(inputs({ action: 'widen' }))).toMatchObject({ ok: false });
  });

  it('refuses an update group that is not an update group id', () => {
    expect(checkInputs(inputs({ action: 'widen', updateGroup: 'abc; rm -rf /' }))).toMatchObject({
      ok: false,
    });
  });

  it('refuses a promotion to beta, since a promotion goes from beta to production', () => {
    expect(checkInputs(inputs({ action: 'promote', updateGroup: 'abc-123' }))).toEqual({
      ok: false,
      error:
        'A promotion republishes a beta update group to production: choose the channel production',
    });
  });

  it('refuses a Deployment address for a widening or a promotion, which build nothing', () => {
    const promote = { action: 'promote', channel: 'production', updateGroup: 'abc-123' };
    expect(checkInputs(inputs({ ...promote, deploymentAddress: STAGING }))).toEqual({
      ok: false,
      error: 'A promotion or a widening builds nothing, so it takes no Deployment address',
    });
    expect(
      checkInputs(inputs({ action: 'widen', updateGroup: 'abc-123', deploymentAddress: STAGING })),
    ).toMatchObject({ ok: false });
  });

  it('widens and promotes an update group', () => {
    expect(checkInputs(inputs({ action: 'widen', updateGroup: 'abc-123' }))).toEqual({
      ok: true,
      request: { action: 'widen', channel: 'beta' },
    });
    expect(
      checkInputs(inputs({ action: 'promote', channel: 'production', updateGroup: 'abc-123' })),
    ).toEqual({ ok: true, request: { action: 'promote', channel: 'production' } });
  });

  it('refuses an address that is not https://', () => {
    expect(checkInputs(inputs({ deploymentAddress: 'http://localhost:8787' }))).toMatchObject({
      ok: false,
    });
  });

  it('refuses an address with a line break or a space, which could forge a step output', () => {
    for (const deploymentAddress of [
      `${STAGING}\nproduction=true`,
      `${STAGING}\rproduction=true`,
      `${STAGING} x`,
      `${STAGING}\u0000`,
    ]) {
      expect(checkInputs(inputs({ deploymentAddress }))).toMatchObject({ ok: false });
    }
  });
});

describe('otaPlan, the plan of a new update', () => {
  it('builds against the production Deployment when no address is given', () => {
    expect(otaPlan(publish({ channel: 'production' }), PRODUCTION)).toEqual({
      ok: true,
      plan: { channel: 'production', address: PRODUCTION, production: true },
    });
  });

  it('takes the production address with a trailing slash as the production Deployment', () => {
    expect(
      otaPlan(publish({ channel: 'production', deploymentAddress: `${PRODUCTION}/` }), PRODUCTION),
    ).toMatchObject({ ok: true, plan: { address: PRODUCTION, production: true } });
  });

  it('lets a beta update be built against the Staging Deployment', () => {
    expect(otaPlan(publish({ deploymentAddress: STAGING }), PRODUCTION)).toEqual({
      ok: true,
      plan: { channel: 'beta', address: STAGING, production: false },
    });
  });

  it('refuses a production publish against any address but the production Deployment’s', () => {
    expect(
      otaPlan(publish({ channel: 'production', deploymentAddress: STAGING }), PRODUCTION),
    ).toEqual({
      ok: false,
      error: `The channel production takes only the production Deployment's address, not "${STAGING}"`,
    });
  });

  it('refuses to run when the production Deployment’s address is unknown or not a plain address', () => {
    for (const productionAddress of [
      '',
      'http://api.example.org',
      `${PRODUCTION}\nproduction=true`,
    ]) {
      expect(otaPlan(publish({}), productionAddress)).toMatchObject({ ok: false });
    }
  });
});
