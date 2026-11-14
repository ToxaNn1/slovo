/**
 * The content snapshot a tool works from (ADR 0090): the records of an
 * Edition live in the backend's Postgres, so a tool that needs the existing
 * records reads a snapshot, never the Edition folder.
 */
import type { ApiFetch, ContentSnapshot } from '@slovo/contracts/api';
import { fetchSnapshot, readSnapshotFile } from '@slovo/language-pack';

export type SnapshotResult =
  | { readonly ok: true; readonly snapshot: ContentSnapshot }
  | { readonly ok: false; readonly error: string };

/**
 * The snapshot saved to `file` when one is named, else the one the backend at
 * `apiUrl` (its `/v1` base or its root) answers. Fails, never giving an empty
 * snapshot, when neither is given, the file is no snapshot, the backend gives
 * none, or the snapshot is of another Edition.
 */
export async function contentSnapshot({
  editionId,
  file,
  apiUrl,
  fetch,
}: {
  editionId: string;
  file: string | undefined;
  apiUrl: string | undefined;
  fetch?: ApiFetch;
}): Promise<SnapshotResult> {
  let snapshot: ContentSnapshot;
  try {
    if (file !== undefined) snapshot = readSnapshotFile(file);
    else if (apiUrl === undefined || apiUrl === '') {
      return {
        ok: false,
        error: `No content snapshot of Edition ${editionId}: pass --snapshot <file> or set SLOVO_API_URL to the backend`,
      };
    } else {
      snapshot = await fetchSnapshot({
        // The contract's routes carry the /v1 prefix themselves.
        apiUrl: apiUrl.replace(/\/v1\/?$/, ''),
        editionId,
        ...(fetch === undefined ? {} : { fetch }),
      });
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, error: file === undefined ? reason : `${file}: ${reason}` };
  }
  return snapshot.editionId === editionId
    ? { ok: true, snapshot }
    : { ok: false, error: `The snapshot is of Edition ${snapshot.editionId}, not ${editionId}` };
}
