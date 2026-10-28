import type { MistakeReport } from '@slovo/contracts';

import type { EditionRegistry, NotServing } from '../edition/edition-registry';
import type { Clock, MistakeReportStore } from '../ports';

/** The Mistake Reports readers send the owner (ADR 0056). */
export interface MistakeReports {
  /**
   * Keeps the report with its time of arrival, when its Edition serves
   * Mistake Reports. Its shape is checked where it enters; whether its Entry
   * is in a pack is not.
   */
  send(report: MistakeReport): Promise<{ readonly ok: true } | NotServing>;
}

export function createMistakeReports({
  editions,
  store,
  clock,
}: {
  editions: EditionRegistry;
  store: MistakeReportStore;
  clock: Clock;
}): MistakeReports {
  return {
    async send(report) {
      const serving = await editions.serving(report.editionId, 'mistakeReports');
      if (!serving.ok) return serving;
      await store.keep({ ...report, receivedAt: clock.now() });
      return { ok: true };
    },
  };
}
