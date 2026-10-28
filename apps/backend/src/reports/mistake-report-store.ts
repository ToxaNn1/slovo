import type { MistakeReportStore } from '@slovo/server-core';

import type { Database } from '../database/database';
import { mistakeReports } from '../database/schema';

/** The Mistake Reports still to check, kept in the `mistake_reports` table. */
export function createMistakeReportStore({ db }: Database): MistakeReportStore {
  return {
    async keep(report) {
      await db.insert(mistakeReports).values({
        editionId: report.editionId,
        entryId: report.entryId,
        type: report.type,
        comment: report.comment,
        appVersion: report.appVersion,
        contentVersion: report.contentVersion,
        receivedAt: report.receivedAt,
      });
    },
  };
}
