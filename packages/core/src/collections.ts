import type { EntryRowModel, EntryRows } from './entry-row';
import type { Clock, Random, UserStateChanges } from './ports';
import type { UserState } from './user-state';
import { userStateRecords } from './user-state-schema';

/** A Collection, as the sheet and the Collections screens draw it. */
export interface Collection {
  readonly id: string;
  /** The name the user gave it, trimmed. */
  readonly name: string;
  /** When the user created it. */
  readonly createdAt: Date;
  /** How many Entries are in it. */
  readonly count: number;
  /**
   * What the rows of its newest Entries lead with, newest first: the Lemma of a
   * Word, and for a Correction the standard equivalent.
   */
  readonly newestLemmas: readonly string[];
}

/** Why a name is refused, for the UI to say in the Edition's words. */
export type CollectionNameRefusal =
  /** Nothing is left of the name once it is trimmed. */
  | 'empty'
  /** More than 40 characters are left. */
  | 'too-long'
  /** Another Collection already has the name, in any letter case. */
  | 'duplicate';

export type CollectionResult =
  | { readonly ok: true; readonly collection: Collection }
  | { readonly ok: false; readonly reason: CollectionNameRefusal };

/**
 * Collections: the groups of Entries the user created and named, with an Entry
 * in as many as the user likes. They keep any Entry the Language Pack has,
 * Retired or not, and are read from the user state once, when they open, like
 * Favorites, so open one per app session (the Core composition does). A change
 * is made in memory only once it is written.
 */
export interface Collections {
  /**
   * The Collections, newest first. A change never edits this array: it makes a
   * new one and tells the subscribers, so the array stays the same until
   * something changes. A Collection that a change did not touch keeps its
   * object.
   */
  readonly list: readonly Collection[];
  /** The Collections the Entry is in, newest first; the same array until a change. */
  of(entryId: string): readonly Collection[];
  /** Whether the Entry is in the Collection. */
  has(collectionId: string, entryId: string): boolean;
  /**
   * Creates a Collection, as of now, with the Entry already in it when one is
   * given (skipped when the Language Pack doesn't have it). The name is refused with a reason when it breaks the name rules,
   * and nothing is kept.
   */
  create(name: string, entryId?: string): Promise<CollectionResult>;
  /**
   * Adds the Entry to the Collection, as of now. An Entry already in it keeps
   * the time it was added; an Entry the Language Pack doesn't have, and a
   * Collection that doesn't exist, are skipped.
   */
  add(collectionId: string, entryId: string): Promise<void>;
  /** Takes the Entry out of the Collection. */
  remove(collectionId: string, entryId: string): Promise<void>;
  /** Calls `listener` after each change of the list. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

const { collections: collectionRecords, collectionEntries: collectionEntryRecords } =
  userStateRecords;

/** The longest name a Collection may have, in characters. */
const NAME_MAX_LENGTH = 40;
/** How many Lemmas a Collection shows of its newest Entries. */
const NEWEST_LEMMAS = 3;
const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 8;
const ID_ATTEMPTS = 5;

/** An Entry in a Collection. */
interface Filed {
  readonly addedAt: Date;
  readonly row: EntryRowModel;
}

interface Stored {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly filed: ReadonlyMap<string, Filed>;
}

const NONE: readonly Collection[] = [];

/** Newest first; things made at the same instant in a stable order. */
function newestFirst<T>(time: (item: T) => Date, key: (item: T) => string) {
  return (first: T, second: T): number => {
    const byTime = time(second).getTime() - time(first).getTime();
    if (byTime !== 0) return byTime;
    return key(first) < key(second) ? -1 : 1;
  };
}

const newestCollection = newestFirst<Collection>(
  (collection) => collection.createdAt,
  (collection) => collection.id,
);

function viewOf({ id, name, createdAt, filed }: Stored): Collection {
  const newest = [...filed.values()].sort(
    newestFirst(
      (item) => item.addedAt,
      (item) => item.row.entryId,
    ),
  );
  return {
    id,
    name,
    createdAt,
    count: filed.size,
    newestLemmas: newest.slice(0, NEWEST_LEMMAS).map((item) => item.row.title),
  };
}

/** The record of an Entry in a Collection: its id is the Collection id, a `.` and the Entry id. */
const entryRecord = (collectionId: string, entryId: string) =>
  collectionEntryRecords.record(`${collectionId}.${entryId}`);

/** The key of a name for comparing: one Unicode form in one letter case. */
const nameKey = (name: string) => name.normalize('NFC').toLowerCase();

/** Opens Collections over the user state, for the Core composition. */
export async function openCollections({
  rows,
  userState,
  clock,
  random,
}: {
  rows: EntryRows;
  userState: UserState;
  clock: Clock;
  random: Random;
}): Promise<Collections> {
  const [storedCollections, storedEntries] = await Promise.all([
    userState.list(collectionRecords),
    userState.list(collectionEntryRecords),
  ]);
  const filedByCollection = new Map<string, Map<string, Filed>>();
  await Promise.all(
    [...storedEntries].map(async ([id, added]) => {
      // Neither id holds a `.`, so the first one splits them.
      const dot = id.indexOf('.');
      const collectionId = id.slice(0, dot);
      const entryId = id.slice(dot + 1);
      if (dot < 0 || !storedCollections.has(collectionId)) return;
      const row = await rows.row(entryId);
      if (row === undefined) return;
      const filed = filedByCollection.get(collectionId) ?? new Map<string, Filed>();
      filed.set(entryId, { addedAt: new Date(added), row });
      filedByCollection.set(collectionId, filed);
    }),
  );
  const collections = new Map<string, Stored>();
  const views = new Map<string, Collection>();
  for (const [id, { name, createdAt }] of storedCollections) {
    const stored = {
      id,
      name,
      createdAt: new Date(createdAt),
      filed: filedByCollection.get(id) ?? new Map<string, Filed>(),
    };
    collections.set(id, stored);
    views.set(id, viewOf(stored));
  }

  let list: readonly Collection[] = NONE;
  let byEntry = new Map<string, readonly Collection[]>();
  const listeners = new Set<() => void>();

  /** Makes the list and the Collections of each Entry again from the views, newest first. */
  function remake(): void {
    list = [...views.values()].sort(newestCollection);
    byEntry = new Map();
    for (const collection of list) {
      for (const entryId of collections.get(collection.id)?.filed.keys() ?? []) {
        byEntry.set(entryId, [...(byEntry.get(entryId) ?? NONE), collection]);
      }
    }
  }
  remake();

  /** Keeps the changed Collection in memory and tells the subscribers. Returns its new view. */
  function change(stored: Stored): Collection {
    const view = viewOf(stored);
    collections.set(stored.id, stored);
    views.set(stored.id, view);
    remake();
    for (const listener of listeners) listener();
    return view;
  }

  const has = (collectionId: string, entryId: string) =>
    collections.get(collectionId)?.filed.has(entryId) ?? false;

  function refusalOf(name: string): CollectionNameRefusal | undefined {
    if (name === '') return 'empty';
    // Count characters, not UTF-16 code units.
    if (Array.from(name).length > NAME_MAX_LENGTH) return 'too-long';
    const key = nameKey(name);
    return list.some((collection) => nameKey(collection.name) === key) ? 'duplicate' : undefined;
  }

  function newId(): string {
    for (let attempt = 0; attempt < ID_ATTEMPTS; attempt += 1) {
      const id = `k_${Array.from(
        { length: ID_LENGTH },
        () => ID_ALPHABET[Math.floor(random.next() * ID_ALPHABET.length)],
      ).join('')}`;
      if (!collections.has(id)) return id;
    }
    throw new Error('The random port gave no free Collection id.');
  }

  async function create(untrimmed: string, entryId?: string): Promise<CollectionResult> {
    const name = untrimmed.trim();
    const reason = refusalOf(name);
    if (reason !== undefined) return { ok: false, reason };
    const id = newId();
    const createdAt = clock.now();
    const row = entryId === undefined ? undefined : await rows.row(entryId);
    const changes = new Map<string, string | undefined>(
      collectionRecords.record(id).change({ name, createdAt: createdAt.toISOString() }),
    );
    const filed = new Map<string, Filed>();
    if (row !== undefined) {
      filed.set(row.entryId, { addedAt: createdAt, row });
      mergeInto(changes, entryRecord(id, row.entryId).change(createdAt.toISOString()));
    }
    await userState.write(changes);
    return { ok: true, collection: change({ id, name, createdAt, filed }) };
  }

  async function add(collectionId: string, entryId: string): Promise<void> {
    const collection = collections.get(collectionId);
    if (collection === undefined || collection.filed.has(entryId)) return;
    const row = await rows.row(entryId);
    if (row === undefined) return;
    const addedAt = clock.now();
    await userState.write(entryRecord(collectionId, entryId).change(addedAt.toISOString()));
    change({ ...collection, filed: new Map([...collection.filed, [entryId, { addedAt, row }]]) });
  }

  async function remove(collectionId: string, entryId: string): Promise<void> {
    const collection = collections.get(collectionId);
    if (collection?.filed.has(entryId) !== true) return;
    await userState.write(entryRecord(collectionId, entryId).change(undefined));
    const filed = new Map(collection.filed);
    filed.delete(entryId);
    change({ ...collection, filed });
  }

  // One change at a time, so each one starts from what the one before it left.
  let lastChange: Promise<unknown> = Promise.resolve();
  function inTurn<T>(work: () => Promise<T>): Promise<T> {
    const result = lastChange.then(work);
    lastChange = result.catch(() => undefined);
    return result;
  }

  return {
    get list() {
      return list;
    },
    of: (entryId) => byEntry.get(entryId) ?? NONE,
    has,
    create: (name, entryId) => inTurn(() => create(name, entryId)),
    add: (collectionId, entryId) => inTurn(() => add(collectionId, entryId)),
    remove: (collectionId, entryId) => inTurn(() => remove(collectionId, entryId)),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function mergeInto(target: Map<string, string | undefined>, changes: UserStateChanges): void {
  for (const [key, value] of changes) target.set(key, value);
}
