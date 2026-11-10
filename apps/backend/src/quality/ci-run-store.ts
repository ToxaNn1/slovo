import type { CiRun, CiRunStore } from '@slovo/server-core';
import { and, asc, gte, lte } from 'drizzle-orm';

import type { Database } from '../database/database';
import { ciRuns } from '../database/schema';

/** The CI runs on `main`, kept in Postgres. */
export function createCiRunStore({ db }: Database): CiRunStore {
  return {
    async add(run) {
      await db
        .insert(ciRuns)
        .values({
          ...run,
          failedTests: [...run.failedTests],
          coverage: [...run.coverage],
          jobs: [...run.jobs],
        })
        .onConflictDoNothing();
    },
    async between(from, to): Promise<readonly CiRun[]> {
      return db
        .select()
        .from(ciRuns)
        .where(and(gte(ciRuns.at, from), lte(ciRuns.at, to)))
        .orderBy(asc(ciRuns.at));
    },
  };
}
