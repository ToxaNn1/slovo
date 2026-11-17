/**
 * The OTA workflow's check before it publishes (`.github/workflows/ota-update.yml`,
 * ADR 0062, 0167): it parses the run's inputs once and refuses an unknown
 * channel, a bad Rollout share or update group, and a `production` publish,
 * widening or promotion against any address but the production Deployment's.
 *
 * Run by the workflow as `node apps/mobile/ota-plan.ts` (Node strips the
 * types) with the inputs in the environment; it writes the plan to
 * `$GITHUB_OUTPUT`. Dependency-free on purpose: it runs before `pnpm install`.
 */
import { appendFileSync } from 'node:fs';
import { argv, env, exit, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

/** The Update channels (`UpdateChannelSchema` in the contracts; the test keeps them equal). */
export const CHANNELS = ['beta', 'production'] as const;
type Channel = (typeof CHANNELS)[number];

const ACTIONS = ['publish', 'widen', 'promote'] as const;
type Action = (typeof ACTIONS)[number];

/** The workflow's inputs, as text, as GitHub hands them over. */
export interface OtaInputs {
  action: string;
  channel: string;
  rollout: string;
  updateGroup: string;
  message: string;
  /** The Deployment address the update is built against; empty means the production Deployment. */
  deploymentAddress: string;
  /** The production Deployment's address: `EXPO_PUBLIC_SLOVO_API_URL` of the EAS environment. */
  productionAddress: string;
}

export interface OtaPlan {
  action: Action;
  channel: Channel;
  address: string;
  /** Whether `address` is the production Deployment's; an update for any other carries no PostHog key (ADR 0168). */
  production: boolean;
}

export type OtaCheck = { ok: true; plan: OtaPlan } | { ok: false; error: string };

function isOneOf<T extends string>(options: readonly T[], value: string): value is T {
  return options.some((option) => option === value);
}

function withoutTrailingSlash(address: string): string {
  return address.replace(/\/+$/, '');
}

export function otaPlan(inputs: OtaInputs): OtaCheck {
  const { action, channel, rollout, updateGroup, message } = inputs;
  if (!isOneOf(ACTIONS, action)) {
    return { ok: false, error: `The action is "${action}": expected publish, widen or promote` };
  }
  if (!isOneOf(CHANNELS, channel)) {
    return { ok: false, error: `The channel is "${channel}": expected beta or production` };
  }
  if (!/^[0-9]+$/.test(rollout) || Number(rollout) < 1 || Number(rollout) > 100) {
    return {
      ok: false,
      error: `The Rollout share is "${rollout}": expected a whole number from 1 to 100`,
    };
  }
  if (action === 'publish') {
    if (updateGroup !== '') {
      return { ok: false, error: 'A new update takes no update group: widen or promote takes one' };
    }
    if (message === '') return { ok: false, error: 'A new update needs a message' };
  } else if (!/^[0-9a-f-]+$/.test(updateGroup)) {
    return {
      ok: false,
      error: `The update group is "${updateGroup}": ${action} needs an update group id`,
    };
  }
  if (action === 'promote' && channel !== 'production') {
    return {
      ok: false,
      error:
        'A promotion republishes a beta update group to production: choose the channel production',
    };
  }
  const productionAddress = withoutTrailingSlash(inputs.productionAddress);
  if (!productionAddress.startsWith('https://')) {
    return {
      ok: false,
      error: `The production Deployment's address is "${productionAddress}": expected an https:// address`,
    };
  }
  const given = withoutTrailingSlash(inputs.deploymentAddress);
  const address = given === '' ? productionAddress : given;
  if (!address.startsWith('https://')) {
    return {
      ok: false,
      error: `The Deployment address is "${address}": expected an https:// address`,
    };
  }
  const production = address === productionAddress;
  if (channel === 'production' && !production) {
    return {
      ok: false,
      error: `The channel production takes only the production Deployment's address, not "${address}"`,
    };
  }
  return { ok: true, plan: { action, channel, address, production } };
}

function main(): void {
  const check = otaPlan({
    action: env['ACTION'] ?? '',
    channel: env['CHANNEL'] ?? '',
    rollout: env['ROLLOUT'] ?? '',
    updateGroup: env['UPDATE_GROUP'] ?? '',
    message: env['MESSAGE'] ?? '',
    deploymentAddress: env['DEPLOYMENT_ADDRESS'] ?? '',
    productionAddress: env['PRODUCTION_ADDRESS'] ?? '',
  });
  if (!check.ok) {
    stdout.write(`::error::${check.error}\n`);
    exit(1);
  }
  const { plan } = check;
  const output = env['GITHUB_OUTPUT'];
  const lines = `address=${plan.address}\nproduction=${String(plan.production)}\n`;
  if (output === undefined || output === '') stdout.write(lines);
  else appendFileSync(output, lines);
}

if (argv[1] === fileURLToPath(import.meta.url)) main();
