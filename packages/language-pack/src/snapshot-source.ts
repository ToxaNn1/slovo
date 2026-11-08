import { readFileSync } from 'node:fs';

import {
  ContentSnapshotSchema,
  createApiClient,
  type ApiFetch,
  type ContentSnapshot,
} from '@slovo/contracts/api';

/** The backend could not give the snapshot: it was not reached, refused or answered something else. */
export class SnapshotUnreachableError extends Error {
  override readonly name = 'SnapshotUnreachableError';

  constructor(apiUrl: string, editionId: string, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`No content snapshot of Edition ${editionId} from ${apiUrl}: ${reason}`, { cause });
  }
}

/**
 * The whole content of an Edition at its current content version, from the
 * backend at `apiUrl`. Throws a SnapshotUnreachableError when the backend
 * can't be reached, refuses or answers something that is not a snapshot.
 */
export async function fetchSnapshot({
  apiUrl,
  editionId,
  fetch,
}: {
  apiUrl: string;
  editionId: string;
  fetch?: ApiFetch;
}): Promise<ContentSnapshot> {
  const client = createApiClient({ url: apiUrl, ...(fetch === undefined ? {} : { fetch }) });
  try {
    return ContentSnapshotSchema.parse(await client.content.snapshot({ editionId }));
  } catch (error) {
    throw new SnapshotUnreachableError(apiUrl, editionId, error);
  }
}

/** A snapshot saved to a file, as the backend answers it. */
export function readSnapshotFile(path: string): ContentSnapshot {
  return ContentSnapshotSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}
