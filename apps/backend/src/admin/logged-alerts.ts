import type { Logger } from 'pino';

import type { Alerts } from '@slovo/server-core';

/** Alerts as log lines, until the Telegram adapter takes their place. */
export function createLoggedAlerts(logger: Logger): Alerts {
  return {
    send(alert) {
      logger.warn({ alert }, `alert: ${alert.kind}`);
      return Promise.resolve();
    },
  };
}
