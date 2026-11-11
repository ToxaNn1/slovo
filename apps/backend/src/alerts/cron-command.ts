// `pnpm cron`: one run of the Cron service, every 15 minutes on Railway
// (.railway/railway.ts): the alert checks, the daily digest after 09:00 Kyiv,
// then the messages to the owner's Telegram chat. A run then exits.
import { fileURLToPath } from 'node:url';

import {
  createMonitor,
  systemClock,
  thresholdsOf,
  type HealthProbe,
  type OpenBatches,
} from '@slovo/server-core';

import { createPostHogClient, unavailablePostHog } from '../analytics/posthog-client';
import { CronConfigSchema, readConfig } from '../config';
import { createContentQueue } from '../content/content-queue';
import { createDatabase } from '../database/database';
import { readEditions } from '../edition/edition-folders';
import { createLogger } from '../logger';
import { createCiRunStore } from '../quality/ci-run-store';
import { sentryOf } from '../quality/sentry-api';
import { createAlertStore, createAlertThresholdStore } from './alert-store';
import { ownerChatOf } from './owner-chat';

/** How long the health check may take before the backend counts as down. */
const HEALTH_TIMEOUT_MS = 10_000;

/** Whether the health URL answers 2xx; with no URL, the backend counts as up. */
export function createHealthProbe(url: string | undefined, fetchWith = fetch): HealthProbe {
  return {
    async up() {
      if (url === undefined) return true;
      try {
        const response = await fetchWith(url, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}

/** The open batches of the Content queue, each with the records it added and changed. */
export function openBatchesOf(
  queue: Pick<ReturnType<typeof createContentQueue>, 'batches'>,
): OpenBatches {
  return {
    async open() {
      const batches = await queue.batches();
      return batches.map(({ id, editionId, added, changed }) => ({
        id,
        editionId,
        records: added + changed,
      }));
    },
  };
}

async function main(): Promise<number> {
  const config = readConfig(CronConfigSchema, process.env);
  const logger = createLogger();
  const database = createDatabase(config.DATABASE_URL, logger);
  const clock = systemClock;
  try {
    const thresholds = createAlertThresholdStore(database);
    await createMonitor({
      settings: { thresholds: () => thresholdsOf(thresholds) },
      store: createAlertStore(database),
      chat: ownerChatOf(config, logger),
      sentry: sentryOf(config, clock),
      posthog:
        config.posthog === undefined ? unavailablePostHog : createPostHogClient(config.posthog),
      ciRuns: createCiRunStore(database),
      health: createHealthProbe(config.BACKEND_HEALTH_URL),
      batches: openBatchesOf(createContentQueue({ database, clock })),
      editionIds: readEditions(config.EDITIONS_DIR).map(({ config: edition }) => edition.id),
      clock,
      logFailure: (message, error) => {
        logger.error({ err: error }, message);
      },
    }).run();
    logger.info('cron run done');
    return 0;
  } catch (error) {
    logger.error({ err: error }, 'cron run failed');
    return 1;
  } finally {
    await database.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = await main();
