import type { ContentReadPort, ReplacedWord, UserStateChanges } from '../ports';
import type { UserState } from '../user-state/user-state';
import type { UserStateRecords } from '../user-state/user-state-record';
import { userStateRecords } from '../user-state-schema';

const earlier = (one: string, other: string): string => (one <= other ? one : other);
const later = (one: string, other: string): string => (one >= other ? one : other);

/**
 * How the records of one kind, one per Entry by Entry id, merge when the
 * Retired Word and the Word replacing it both hold one (ADR 0214): `merge`
 * gives the record the replacing Word keeps, of the Retired Word's and its own.
 */
interface MovedRecords<T> {
  readonly records: UserStateRecords<T>;
  readonly merge: (retired: T, own: T) => T;
}

const moved = <T>(records: UserStateRecords<T>, merge: (retired: T, own: T) => T) => ({
  records,
  merge,
});

const {
  favorites,
  collectionEntries,
  history,
  wordOfTheDayArchive,
  knowledge,
  confirmed,
  reviewAnswered,
  seen,
  hiddenEntries,
} = userStateRecords;

/** The changes that move the records of the kind, each by the id its key ends with. */
async function movesOf<T>(
  userState: UserState,
  { records, merge }: MovedRecords<T>,
  replacingOf: (entryId: string) => string | undefined,
  /** The id of the Entry in a record's id, and the record's id for another Entry. */
  entryIn: (id: string) => { entryId: string; idFor: (entryId: string) => string } = (id) => ({
    entryId: id,
    idFor: (entryId) => entryId,
  }),
): Promise<UserStateChanges> {
  const kept = await userState.list(records);
  const changes = new Map<string, string | undefined>();
  /** What each replacing record holds by now, as several Retired Words may name one Word. */
  const merged = new Map<string, T>();
  for (const [id, value] of kept) {
    const { entryId, idFor } = entryIn(id);
    const replacing = replacingOf(entryId);
    if (replacing === undefined) continue;
    const target = idFor(replacing);
    const own = merged.get(target) ?? kept.get(target);
    const next = own === undefined ? value : merge(value, own);
    merged.set(target, next);
    for (const [key, text] of records.record(id).change(undefined)) changes.set(key, text);
    for (const [key, text] of records.record(target).change(next)) changes.set(key, text);
  }
  return changes;
}

/**
 * Moves every record the reader keeps of a Retired Word to the Word that
 * replaces it (ADR 0214): Favorites, Collection entries, History, the Word of
 * the Day archive, the Knowledge Mark, confirmed, the Review answer, Seen and
 * Hidden. Both holding a record, the replacing Word keeps the earlier add of
 * Favorites, a Collection, confirmed and Hidden, the later of History, the
 * Review answer and Seen, and the Knowledge Mark answered later, its own when
 * neither tells. A replacing Word Retired and replaced in turn is followed to
 * the last one. One write, and none when nothing is left to move, so a second
 * run changes nothing and the devices of an Account converge through Sync.
 */
export async function moveToReplacingWords({
  content,
  userState,
}: {
  content: Pick<ContentReadPort, 'listReplacedWords'>;
  userState: UserState;
}): Promise<void> {
  const replacedBy = new Map(
    (await content.listReplacedWords()).map(({ id, replacedBy }: ReplacedWord) => [id, replacedBy]),
  );
  if (replacedBy.size === 0) return;
  /** The last Word of the chain that replaces the Entry; none for an Entry not replaced, or a chain that loops. */
  const replacingOf = (entryId: string): string | undefined => {
    const passed = new Set([entryId]);
    let last = replacedBy.get(entryId);
    if (last === undefined) return undefined;
    for (let next = replacedBy.get(last); next !== undefined; next = replacedBy.get(last)) {
      if (passed.has(last)) return undefined;
      passed.add(last);
      last = next;
    }
    return passed.has(last) ? undefined : last;
  };

  const archive = await userState.list(wordOfTheDayArchive);
  const changes = new Map<string, string | undefined>([
    ...(await movesOf(userState, moved(favorites, earlier), replacingOf)),
    // A Collection entry is kept by its Collection's id, a `.` and the Entry's id; neither holds a `.`.
    ...(await movesOf(userState, moved(collectionEntries, earlier), replacingOf, (id) => {
      const dot = id.indexOf('.');
      return {
        entryId: id.slice(dot + 1),
        idFor: (entryId) => `${id.slice(0, dot + 1)}${entryId}`,
      };
    })),
    ...(await movesOf(
      userState,
      moved(history, (retired, own) => (retired.seenAt > own.seenAt ? retired : own)),
      replacingOf,
    )),
    ...(await movesOf(
      userState,
      moved(knowledge, (retired, own) =>
        (retired.markedAt ?? '') > (own.markedAt ?? '') ? retired : own,
      ),
      replacingOf,
    )),
    ...(await movesOf(userState, moved(confirmed, earlier), replacingOf)),
    ...(await movesOf(userState, moved(reviewAnswered, later), replacingOf)),
    ...(await movesOf(userState, moved(seen, Math.max), replacingOf)),
    ...(await movesOf(userState, moved(hiddenEntries, earlier), replacingOf)),
    // The archive keeps the Word of each local date as the record's value.
    ...[...archive].flatMap(([date, entryId]) => {
      const replacing = replacingOf(entryId);
      return replacing === undefined ? [] : [...wordOfTheDayArchive.record(date).change(replacing)];
    }),
  ]);
  if (changes.size > 0) await userState.write(changes);
}
