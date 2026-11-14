/**
 * The Words the videos show, read from `snapshot.json`: a slice of the UA
 * Edition's content snapshot (ADR 0090), never the Edition folder's files.
 */
import snapshot from './snapshot.json';

export type VideoWord = (typeof snapshot.words)[number];

/** The Word with the given id; throws when the snapshot has none. */
export function word(id: string): VideoWord {
  const found = snapshot.words.find((each) => each.id === id);
  if (found === undefined) throw new Error(`No Word ${id} in apps/video/src/snapshot.json`);
  return found;
}
