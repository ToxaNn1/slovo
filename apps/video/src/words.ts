/**
 * The Words the videos show, read from `snapshot.json`: a slice of the UA
 * Edition's content snapshot (ADR 0090), never the Edition folder's files.
 * It is parsed once, here, against the snapshot contract.
 */
import { ContentSnapshotSchema, type ContentSnapshot } from '@slovo/contracts/api';

import snapshot from './snapshot.json';

const { words } = ContentSnapshotSchema.parse(snapshot);

export type VideoWord = ContentSnapshot['words'][number];

/** The Word with the given id; throws when the snapshot has none. */
export function word(id: string): VideoWord {
  const found = words.find((each) => each.id === id);
  if (found === undefined) throw new Error(`No Word ${id} in apps/video/src/snapshot.json`);
  return found;
}
