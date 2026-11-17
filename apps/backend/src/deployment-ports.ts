import type { Clock, PostHogPort } from '@slovo/server-core';

import { createPostHogClient, unavailablePostHog } from './analytics/posthog-client';
import type { ServerConfig } from './config';
import {
  memoryMediaStore,
  publicMediaStore,
  r2MediaStore,
  type MediaStore,
} from './media/media-store';

/** The ports that differ between the Deployment and the Staging Deployment (ADR 0168). */
interface DeploymentPorts {
  readonly posthog: PostHogPort;
  readonly mediaStore: MediaStore;
  /** The environment Sentry files the backend's reports under. */
  readonly sentryEnvironment: ServerConfig['DEPLOYMENT'];
}

/**
 * The Analytics reads, the Media Store and the Sentry environment of a
 * backend. The Staging Deployment sends nothing to PostHog and writes nothing
 * to the Media Store, which it reads at its public URLs only.
 */
export function deploymentPorts(
  config: Pick<ServerConfig, 'DEPLOYMENT' | 'posthog' | 'r2' | 'mediaBase'>,
  { clock, fetch: send = fetch }: { clock: Clock; fetch?: typeof fetch },
): DeploymentPorts {
  const sentryEnvironment = config.DEPLOYMENT;
  if (config.DEPLOYMENT === 'staging') {
    return {
      posthog: unavailablePostHog,
      mediaStore: publicMediaStore(config.mediaBase, { fetch: send }),
      sentryEnvironment,
    };
  }
  return {
    posthog:
      config.posthog === undefined ? unavailablePostHog : createPostHogClient(config.posthog, send),
    // Unset in development, the Media Store's files stay in memory.
    mediaStore:
      config.r2 === undefined
        ? memoryMediaStore()
        : r2MediaStore(config.r2, { clock, fetch: send }),
    sentryEnvironment,
  };
}
