/**
 * The OTA workflow's checks (`.github/workflows/ota-update.yml`, ADR 0062,
 * 0167). Before any EAS call, `checkInputs` parses the run's inputs once and
 * refuses an unknown action or channel, a bad Rollout share, update group or
 * Deployment address. For a new update, `otaPlan` then refuses a `production`
 * publish against any address but the production Deployment's.
 *
 * Run by the workflow after `pnpm install` with the inputs in the
 * environment: `tsx ota-plan.ts inputs` checks the inputs alone;
 * `tsx ota-plan.ts publish` also plans a new update and writes the plan to
 * `$GITHUB_OUTPUT`.
 */
import { appendFileSync } from 'node:fs';
import { argv, env, exit, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

import { UpdateChannelSchema, type UpdateChannel } from '@slovo/contracts';

const ACTIONS = ['publish', 'widen', 'promote'] as const;

/**
 * A Deployment address: https, a host, an optional port and path, and no
 * space or control character, so it cannot forge a line of `$GITHUB_OUTPUT`.
 */
const ADDRESS = /^https:\/\/[A-Za-z0-9.-]+(?::[0-9]+)?(?:\/[A-Za-z0-9._~%/-]*)?$/;

/** The workflow's inputs, as text, as GitHub hands them over. */
export interface OtaInputs {
  action: string;
  channel: string;
  rollout: string;
  updateGroup: string;
  message: string;
  /** The Deployment address a new update is built against; empty means the production Deployment. */
  deploymentAddress: string;
}

/** The checked inputs of a new update. */
export interface OtaPublish {
  action: 'publish';
  channel: UpdateChannel;
  /** Without a trailing slash; undefined means the production Deployment. */
  deploymentAddress: string | undefined;
}

/** The checked inputs of a run: a new update, or a published update group to widen or promote. */
export type OtaRequest = OtaPublish | { action: 'widen' | 'promote'; channel: UpdateChannel };

export interface OtaPlan {
  channel: UpdateChannel;
  address: string;
  /** Whether `address` is the production Deployment's; an update for any other carries no PostHog key (ADR 0168). */
  production: boolean;
}

export type OtaCheck = { ok: true; request: OtaRequest } | { ok: false; error: string };
export type OtaPlanCheck = { ok: true; plan: OtaPlan } | { ok: false; error: string };

function isOneOf<T extends string>(options: readonly T[], value: string): value is T {
  return options.some((option) => option === value);
}

function withoutTrailingSlash(address: string): string {
  return address.replace(/\/+$/, '');
}

export function checkInputs(inputs: OtaInputs): OtaCheck {
  const { action, rollout, updateGroup, message } = inputs;
  if (!isOneOf(ACTIONS, action)) {
    return { ok: false, error: `The action is "${action}": expected publish, widen or promote` };
  }
  const channel = UpdateChannelSchema.safeParse(inputs.channel);
  if (!channel.success) {
    return {
      ok: false,
      error: `The channel is "${inputs.channel}": expected ${UpdateChannelSchema.options.join(' or ')}`,
    };
  }
  if (!/^[0-9]+$/.test(rollout) || Number(rollout) < 1 || Number(rollout) > 100) {
    return {
      ok: false,
      error: `The Rollout share is "${rollout}": expected a whole number from 1 to 100`,
    };
  }
  const given = withoutTrailingSlash(inputs.deploymentAddress);
  if (given !== '' && !ADDRESS.test(given)) {
    return {
      ok: false,
      error: `The Deployment address is ${JSON.stringify(given)}: expected an https:// address`,
    };
  }
  if (action === 'publish') {
    if (updateGroup !== '') {
      return { ok: false, error: 'A new update takes no update group: widen or promote takes one' };
    }
    if (message === '') return { ok: false, error: 'A new update needs a message' };
    return {
      ok: true,
      request: {
        action,
        channel: channel.data,
        deploymentAddress: given === '' ? undefined : given,
      },
    };
  }
  if (!/^[0-9a-f-]+$/.test(updateGroup)) {
    return {
      ok: false,
      error: `The update group is "${updateGroup}": ${action} needs an update group id`,
    };
  }
  if (given !== '') {
    return {
      ok: false,
      error: 'A promotion or a widening builds nothing, so it takes no Deployment address',
    };
  }
  if (action === 'promote' && channel.data !== 'production') {
    return {
      ok: false,
      error:
        'A promotion republishes a beta update group to production: choose the channel production',
    };
  }
  return { ok: true, request: { action, channel: channel.data } };
}

/** The plan of a new update, given the production Deployment's address from the EAS environment. */
export function otaPlan(request: OtaPublish, productionAddressText: string): OtaPlanCheck {
  const productionAddress = withoutTrailingSlash(productionAddressText);
  if (!ADDRESS.test(productionAddress)) {
    return {
      ok: false,
      error: `The production Deployment's address is ${JSON.stringify(productionAddress)}: expected an https:// address`,
    };
  }
  const address = request.deploymentAddress ?? productionAddress;
  const production = address === productionAddress;
  if (request.channel === 'production' && !production) {
    return {
      ok: false,
      error: `The channel production takes only the production Deployment's address, not "${address}"`,
    };
  }
  return { ok: true, plan: { channel: request.channel, address, production } };
}

function refuse(error: string): never {
  stdout.write(`::error::${error}\n`);
  exit(1);
}

function main(mode: string | undefined): void {
  const check = checkInputs({
    action: env['ACTION'] ?? '',
    channel: env['CHANNEL'] ?? '',
    rollout: env['ROLLOUT'] ?? '',
    updateGroup: env['UPDATE_GROUP'] ?? '',
    message: env['MESSAGE'] ?? '',
    deploymentAddress: env['DEPLOYMENT_ADDRESS'] ?? '',
  });
  if (!check.ok) refuse(check.error);
  if (mode === 'inputs') return;
  if (mode !== 'publish') refuse(`The mode is "${mode ?? ''}": expected inputs or publish`);
  const { request } = check;
  if (request.action !== 'publish') refuse(`A ${request.action} plans no new update`);
  const planned = otaPlan(request, env['PRODUCTION_ADDRESS'] ?? '');
  if (!planned.ok) refuse(planned.error);
  const { plan } = planned;
  const output = env['GITHUB_OUTPUT'];
  const lines = `address=${plan.address}\nproduction=${String(plan.production)}\n`;
  if (output === undefined || output === '') stdout.write(lines);
  else appendFileSync(output, lines);
}

if (argv[1] === fileURLToPath(import.meta.url)) main(argv[2]);
