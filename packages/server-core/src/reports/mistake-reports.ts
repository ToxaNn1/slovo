import type { MistakeReport } from '@slovo/contracts';

import type { EditionRegistry, NotServing } from '../edition/edition-registry';
import type { Clock, MistakeReportStore, RateLimits } from '../ports';
import { countRequest, ipSubject, type TooManyRequests } from '../rate-limit';

/** The reports one IP address may send in a day (ADR 0056). */
const REPORTS_PER_IP = { requests: 10, windowSeconds: 24 * 60 * 60 } as const;

/** The Mistake Reports readers send the owner (ADR 0056). */
export interface MistakeReports {
  /**
   * Keeps the report with its time of arrival, when its Edition serves
   * Mistake Reports. Its shape is checked where it enters; whether its Entry
   * is in a pack is not. A report over the day's limit of its IP address is
   * refused; one its Edition doesn't take counts nothing.
   */
  send(
    report: MistakeReport,
    ip: string,
  ): Promise<{ readonly ok: true } | NotServing | TooManyRequests>;
}

export function createMistakeReports({
  editions,
  store,
  rateLimits,
  clock,
}: {
  editions: EditionRegistry;
  store: MistakeReportStore;
  rateLimits: RateLimits;
  clock: Clock;
}): MistakeReports {
  return {
    async send(report, ip) {
      const serving = await editions.serving(report.editionId, 'mistakeReports');
      if (!serving.ok) return serving;
      const refused = await countRequest(
        rateLimits,
        `reportsPerIp:${ipSubject(ip)}`,
        REPORTS_PER_IP,
        clock.now(),
      );
      if (refused !== undefined) return refused;
      await store.keep({ ...report, receivedAt: clock.now() });
      return { ok: true };
    },
  };
}
