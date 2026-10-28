import { eq } from 'drizzle-orm';

import type { Database } from '../database/database';
import { collectionLinks } from '../database/schema';

/** What `collection-links delete` prints and the code it exits with. */
export interface DeleteOutcome {
  readonly exitCode: 0 | 1;
  readonly line: string;
}

/**
 * Deletes the Collection Link of the id, so the owner can take down an
 * abusive name (ADR 0058) and reading the link answers NOT_FOUND. An id the
 * database doesn't keep deletes nothing and says so.
 */
export async function deleteCollectionLink({ db }: Database, id: string): Promise<DeleteOutcome> {
  const deleted = await db
    .delete(collectionLinks)
    .where(eq(collectionLinks.id, id))
    .returning({ id: collectionLinks.id });
  return deleted.length === 0
    ? { exitCode: 1, line: `No Collection Link ${id} to delete.` }
    : { exitCode: 0, line: `Deleted Collection Link ${id}.` };
}
