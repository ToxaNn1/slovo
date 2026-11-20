import type { Clock, UsagePort } from '@slovo/server-core';
import type { Logger } from 'pino';

import type { PostHogSettings } from '../analytics/posthog-client';
import { createRailwayUsage, type RailwaySettings } from './railway-usage';
import {
  createCloudflareUsage,
  createGitHubActionsUsage,
  createNeonUsage,
  createPostHogUsage,
  createSentryUsage,
} from './usage-sources';

/** The keys the usage ports read with, from the backend's or the alerts Cron's environment. */
export interface UsageKeys {
  readonly SENTRY_AUTH_TOKEN?: string | undefined;
  readonly SENTRY_ORG?: string | undefined;
  readonly posthog: PostHogSettings | undefined;
  readonly railway: RailwaySettings | undefined;
  readonly NEON_API_KEY?: string | undefined;
  readonly NEON_PROJECT_ID?: string | undefined;
  readonly GITHUB_TOKEN?: string | undefined;
  readonly GITHUB_REPOSITORY: string;
  readonly CLOUDFLARE_API_TOKEN?: string | undefined;
  readonly R2_ACCOUNT_ID?: string | undefined;
  readonly R2_BUCKET?: string | undefined;
}

/** Each Service's usage port by the Service's name: «Сервіси» and the alerts Cron read the same. */
export function usagePortsOf(
  keys: UsageKeys,
  { clock, logger }: { readonly clock: Clock; readonly logger: Logger },
): Record<string, UsagePort> {
  return {
    Sentry: createSentryUsage({
      token: keys.SENTRY_AUTH_TOKEN,
      org: keys.SENTRY_ORG,
      clock,
      logger,
    }),
    PostHog: createPostHogUsage({ settings: keys.posthog, logger }),
    ...createRailwayUsage({ settings: keys.railway, clock, logger }),
    Neon: createNeonUsage({ apiKey: keys.NEON_API_KEY, projectId: keys.NEON_PROJECT_ID, logger }),
    GitHub: createGitHubActionsUsage({
      token: keys.GITHUB_TOKEN,
      repository: keys.GITHUB_REPOSITORY,
      clock,
      logger,
    }),
    Cloudflare: createCloudflareUsage({
      token: keys.CLOUDFLARE_API_TOKEN,
      accountId: keys.R2_ACCOUNT_ID,
      bucket: keys.R2_BUCKET,
      clock,
      logger,
    }),
  };
}
