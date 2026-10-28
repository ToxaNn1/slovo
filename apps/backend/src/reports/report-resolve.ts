import { eq } from 'drizzle-orm';
import { z } from 'zod';

import type { Database } from '../database/database';
import { mistakeReports } from '../database/schema';

/** What `reports resolve` prints and the code it exits with. */
export interface ResolveOutcome {
  readonly exitCode: 0 | 1;
  readonly line: string;
}

/**
 * Deletes the Mistake Report of the id once the owner has checked it
 * (ADR 0056), so `reports list` no longer prints it. An id the database
 * doesn't keep, a malformed one included, resolves nothing and says so.
 */
export async function resolveReport({ db }: Database, id: string): Promise<ResolveOutcome> {
  const deleted = z.uuid().safeParse(id).success
    ? await db
        .delete(mistakeReports)
        .where(eq(mistakeReports.id, id))
        .returning({ id: mistakeReports.id })
    : [];
  return deleted.length === 0
    ? { exitCode: 1, line: `No Mistake Report ${id} to resolve.` }
    : { exitCode: 0, line: `Resolved Mistake Report ${id}.` };
}
